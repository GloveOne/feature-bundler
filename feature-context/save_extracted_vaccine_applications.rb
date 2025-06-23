# File Path: app/graphql/graph/types/mutations/save_extracted_vaccine_applications.rb

# Observations and TODOs: (Retained from your original)
#
# 2. Robustness of find_manufacturer_by_name_or_alias: This is the main "TODO".
# If this consistently returns nil because Gemini's manufacturer_name strings don't exactly match your DB,
# then resolve_vaccine_manufacturer will often fall back to vaccine.default_manufacturer or the first available VaccineManufacturer.
# This might not always be what the user intends if Gemini extracted a specific manufacturer that just wasn't an exact string match.
#
# 3. Creation of new VaccineManufacturer records: VaccineManufacturer.find_or_create_by!(...) is convenient.
# Ensure that your VaccineManufacturer model doesn't have other validates_presence_of for attributes not provided in the find_or_create_by!
# call, or that those attributes have database defaults. If creation fails validation, it will raise ActiveRecord::RecordInvalid,
# which will be caught by the helper's rescue block, resolve_vaccine_manufacturer will return nil, and that application will error out.
# This is generally correct behavior.
#
# 4. SuggestUseCase Error Handling: created_shots_list.each { |s| SuggestUseCase.new.call(s.patient)
# rescue Rails.logger.error("Error calling SuggestUseCase for patient #{s.patient_id}") }
# This silently rescues any error from SuggestUseCase.new.call(s.patient) and just logs it.
# This prevents the whole mutation from failing if SuggestUseCase has an issue.
# This is often the desired behavior for non-critical side effects. Confirm this is the intent.

# Ensure necessary types are loaded
require_dependency 'graph/types/vaccine_shot_type'
require_dependency 'graph/types/local_date_type'
# If input/payload types were moved to separate files, ensure they are required or autoloaded.

module Graph
  module Types
    module Mutations
      class SaveExtractedVaccineApplications < ::Graph::BaseMutation
        description "Saves a list of extracted and user-confirmed vaccine applications as external shots for a patient. Attempts to save all valid applications and reports errors for failures."

        # === INPUT TYPES (Nested) ===
        class ExtractedApplicationInputType < GraphQL::Schema::InputObject
          graphql_name "ExtractedVaccineApplicationInput"
          description "Data for a single vaccine application to be saved."

          argument :vaccine_id, ID, required: true, description: "ID of the selected vaccine from the system's active list."
          argument :application_date, Graph::Types::LocalDateType, required: true, description: "Date of application (YYYY-MM-DD)."
          argument :dose_id, String, required: false, description: "The string/symbol ID of the selected dose (e.g., 'D1', 'U')."
          argument :manufacturer_name, String, required: false, description: "Name of the manufacturer (as extracted/edited by user)."
          argument :batch_number, String, required: false, description: "Batch number of the vaccine."
          argument :observations, String, required: false, description: "User notes or observations for this application (can include AI extracted dose info)."
        end

        class SaveApplicationsInputType < GraphQL::Schema::InputObject
          graphql_name "SaveExtractedVaccineApplicationsInput"
          argument :patient_id, ID, required: true, description: "ID of the patient."
          argument :applications, [ExtractedApplicationInputType], required: true,
                    description: "List of vaccine applications to save. Must not be empty."
        end

        input_type SaveApplicationsInputType

        # === PAYLOAD TYPE (Nested, with unique name) ===
        # ... (Payload types remain the same) ...
        class ProcessedApplicationResultType < GraphQL::Schema::Object
          graphql_name "ProcessedApplicationResult"
          description "Result for a single processed application attempt."

          field :input_index, Int, null: false, description: "Original 0-based index of the application in the input list."
          field :shot, Graph::Types::ExternalShotType, null: true,
                description: "The created shot record if this specific application was saved successfully."
          field :success, Boolean, null: false, description: "True if this specific application was saved successfully."
          field :errors, [String], null: true, description: "Errors specific to this application, if any."
        end

        class SaveUserRevisedVaccineApplicationsPayloadType < GraphQL::Schema::Object # Renamed payload
          graphql_name "SaveUserRevisedVaccineApplicationsPayload" # Unique GraphQL name
          description "Result of attempting to save extracted vaccine applications, indicating partial success if applicable."

          field :overall_success, Boolean, null: false,
                description: "True if ALL applications were saved successfully. False if ANY application failed."
          field :processed_applications, [ProcessedApplicationResultType], null: false,
                description: "List of results for each processed application attempt."
        end

        field :payload, SaveUserRevisedVaccineApplicationsPayloadType, null: false

        # === RESOLVE METHOD ===
        def resolve(patient_id:, applications:, **other_args_if_any)
          applications_attrs = applications
          Rails.logger.info "[SaveExtractedVaccineApplications] Attempting to save #{applications_attrs.try(:count) || 0} applications for patient_id: #{patient_id}."

          actual_patient = find_node(patient_id)&.or_nil
          unless actual_patient
            Rails.logger.warn "[SaveExtractedVaccineApplications] Patient not found with ID: #{patient_id}."
            failed_results = (applications_attrs || []).map.with_index do |_, index|
              { input_index: index, success: false, shot: nil, errors: ["Paciente não encontrado."] }
            end
            return { payload: { overall_success: false, processed_applications: failed_results.presence || [] } }
          end

          if applications_attrs.blank?
            Rails.logger.warn "[SaveExtractedVaccineApplications] No applications provided for patient_id: #{patient_id}."
            return { payload: { overall_success: false, processed_applications: [] } }
          end

          processed_results = []
          any_errors_occurred_in_batch = false

          applications_attrs.each_with_index do |app_input_hash, index|
            app_identifier_for_log = "App ##{index + 1} (VaccineID: #{app_input_hash[:vaccine_id]}, DoseID: #{app_input_hash[:dose_id]}) for patient #{patient_id}"
            Rails.logger.info "[SaveExtractedVaccineApplications] Processing #{app_identifier_for_log}"

            current_app_errors = []
            created_shot_for_this_app = nil

            begin
              # --- Resolve Vaccine ---
              vaccine = find_node(app_input_hash[:vaccine_id])&.or_nil
              unless vaccine.is_a?(::Vaccine) && vaccine.chain_id == current_chain.id && vaccine.active?
                current_app_errors << "Vacina inválida (ID: '#{app_input_hash[:vaccine_id]}'), não encontrada, inativa ou não pertence à cadeia correta."
                raise StandardError, "Vaccine validation failed for #{app_identifier_for_log}"
              end

               # --- Resolve Dose ---
              resolved_dose = nil
              if app_input_hash[:dose_id].present?
                dose_id_from_input = app_input_hash[:dose_id] # This is the raw string like "D1"

                if vaccine.rule&.calendar
                  # <<<< CORRECTED LOGIC >>>>
                  # 1. Get all possible dose objects for this vaccine's calendar.
                  all_possible_doses = vaccine.rule.calendar.all_doses

                  # 2. Find the specific dose by its ID within that array.
                  #    The Dose object's ID is likely a symbol, so we convert the input to a symbol.
                  resolved_dose = all_possible_doses.find { |dose| dose.id == dose_id_from_input.to_sym }
                end
                
                unless resolved_dose
                  current_app_errors << "Dose inválida (ID: '#{dose_id_from_input}') para a vacina '#{vaccine.name}'."
                  raise StandardError, "Dose validation failed for #{app_identifier_for_log}"
                end
              end

              # --- Resolve Manufacturer & VaccineManufacturer ---
              manufacturer_obj = nil
              if app_input_hash[:manufacturer_name].present? && app_input_hash[:manufacturer_name] != ::GeminiApiService::DEFAULT_VALUE_FOR_MISSING_FIELD
                manufacturer_obj = find_manufacturer_by_name_or_alias(app_input_hash[:manufacturer_name], current_chain)
              end
              vaccine_manufacturer = resolve_vaccine_manufacturer(vaccine, manufacturer_obj, current_chain)
              unless vaccine_manufacturer
                current_app_errors << "Não foi possível determinar/criar o produto Vacina/Fabricante para Vacina '#{vaccine.name}' com o fabricante fornecido '#{app_input_hash[:manufacturer_name]}'."
                raise StandardError, "VaccineManufacturer resolution failed for #{app_identifier_for_log}"
              end

              # --- Prepare Shot Attributes ---
              shot_attributes = {
                patient: actual_patient, clinic: current_clinic, status: Shot::Status::APPLIED,
                date: app_input_hash[:application_date], sale_date: app_input_hash[:application_date],
                vaccine_manufacturer: vaccine_manufacturer, batch: app_input_hash[:batch_number].presence,
                observations: app_input_hash[:observations].presence, registered_by: current_user,
                external: true,
                external_batch_and_manufacturer: format_external_batch_manufacturer(app_input_hash[:batch_number], app_input_hash[:manufacturer_name]),
                audit: { user: current_user, clinic: current_clinic },
                dose_id: resolved_dose&.id,
                skip_dose_validation: app_input_hash[:dose_id].blank?
              }

              shot_to_save = Shot.new(shot_attributes)

              if shot_to_save.save
                created_shot_for_this_app = shot_to_save
                Rails.logger.info "[SaveExtractedVaccineApplications] Saved Shot ID: #{shot_to_save.id} for #{app_identifier_for_log}"
                SuggestUseCase.new.call(shot_to_save.patient) rescue Rails.logger.error("[SaveExtractedVaccineApplications] Error SuggestUseCase for patient #{shot_to_save.patient_id}: #{$!.message}")
              else
                current_app_errors.concat(shot_to_save.errors.full_messages)
                Rails.logger.warn "[SaveExtractedVaccineApplications] Failed to save #{app_identifier_for_log}: #{current_app_errors.join(', ')}"
              end
            rescue StandardError => e
              Rails.logger.error "[SaveExtractedVaccineApplications] Error during pre-save processing for #{app_identifier_for_log}: #{e.class.name} - #{e.message}"
              current_app_errors << "Erro interno ao processar aplicação: #{e.message}" unless current_app_errors.any?
            end

            if current_app_errors.empty? && created_shot_for_this_app
              processed_results << { input_index: index, success: true, shot: created_shot_for_this_app, errors: nil }
            else
              processed_results << { input_index: index, success: false, shot: nil, errors: current_app_errors.presence || ["Falha desconhecida ao salvar esta aplicação."] }
              any_errors_occurred_in_batch = true
            end
          end

          final_payload = {
            overall_success: !any_errors_occurred_in_batch,
            processed_applications: processed_results
          }

          if any_errors_occurred_in_batch
            Rails.logger.warn "[SaveExtractedVaccineApplications] Completed patient_id: #{patient_id} with errors."
          else
            Rails.logger.info "[SaveExtractedVaccineApplications] All applications processed successfully for patient_id: #{patient_id}."
          end

          { payload: final_payload }

        rescue StandardError => e
          Rails.logger.error "[SaveExtractedVaccineApplications] CRITICAL UNEXPECTED error for patient_id: #{patient_id}. Error: #{e.class.name} - #{e.message}\n#{e.backtrace.first(10).join("\n")}"
          general_error_message = "Ocorreu um erro inesperado no servidor ao processar o lote: #{e.message}"
          failed_app_results = (applications_attrs || []).map.with_index do |_, index|
            { input_index: index, success: false, shot: nil, errors: [general_error_message] }
          end
          if failed_app_results.empty? && (applications_attrs.nil? || applications_attrs.blank?)
             failed_app_results = [{input_index: 0, success: false, shot: nil, errors: [general_error_message]}]
          end
          { payload: { overall_success: false, processed_applications: failed_app_results } }
        end

        private

        def find_manufacturer_by_name_or_alias(name_str, chain_arg)
          return nil if name_str.blank? || name_str == ::GeminiApiService::DEFAULT_VALUE_FOR_MISSING_FIELD
          # Rails.logger.debug "[FMANA] Searching for manufacturer name: '#{name_str}' in chain: #{chain_arg.id}"
          manufacturer = chain_arg.manufacturers.where("LOWER(name) = ?", name_str.downcase.strip).first
          # if manufacturer
          #   Rails.logger.debug "[FMANA] Found manufacturer: ID=#{manufacturer.id}, Name='#{manufacturer.name}'"
          # else
          #   Rails.logger.debug "[FMANA] Manufacturer NOT found by exact name: '#{name_str}'"
          # end
          manufacturer
        end

        def resolve_vaccine_manufacturer(vaccine, manufacturer_obj_from_find, chain_arg_passed_in)
          # Rails.logger.debug "[RVM] Input vaccine: ID=#{vaccine&.id}, Name='#{vaccine&.name}'"
          # Rails.logger.debug "[RVM] Input manufacturer_obj_from_find: #{manufacturer_obj_from_find.inspect} (Name: '#{manufacturer_obj_from_find&.name}')"
          # Rails.logger.debug "[RVM] Input chain_arg_passed_in: ID=#{chain_arg_passed_in&.id}, Name='#{chain_arg_passed_in&.name}'"

          return nil unless vaccine && chain_arg_passed_in

          target_mfr = manufacturer_obj_from_find
          if target_mfr.nil?
            default_mfr_candidate = vaccine.try(:default_manufacturer)
            # Rails.logger.debug "[RVM] vaccine.try(:default_manufacturer) returned: #{default_mfr_candidate.inspect} (Name: '#{default_mfr_candidate&.name}')"
            if default_mfr_candidate && default_mfr_candidate.name != ::Manufacturer::UNAVAILABLE_MANUFACTURER
              target_mfr = default_mfr_candidate
            end
          end
          # Rails.logger.debug "[RVM] After considering default, target_mfr is #{target_mfr.inspect} (Name: '#{target_mfr&.name}')"

          if target_mfr
            unless target_mfr.is_a?(::Manufacturer)
              Rails.logger.error "[RVMHelper] Invalid type for target_mfr (expected Manufacturer) for Vaccine '#{vaccine.name}'. Got #{target_mfr.class}."
              return nil
            end

            # Rails.logger.debug "[RVM] Attempting find_or_create_by! VM with vaccine_id: #{vaccine.id}, manufacturer_id: #{target_mfr.id}, chain_id: #{chain_arg_passed_in.id}"
            vm = ::VaccineManufacturer.find_or_create_by!(
              vaccine: vaccine,
              manufacturer: target_mfr,
              chain: chain_arg_passed_in # Use the correctly scoped chain object
            ) do |new_vm_being_initialized|
              log_chain_name = chain_arg_passed_in.respond_to?(:name) ? chain_arg_passed_in.name : "CHAIN_OBJECT_INVALID_OR_NAME_UNAVAILABLE"
              Rails.logger.info "[RVMHelper] Creating new VaccineManufacturer record for Vaccine: '#{vaccine.name}', Manufacturer: '#{target_mfr.name}', Chain: '#{log_chain_name}'."
            end
            # Rails.logger.debug "[RVM] Found or created VM: ID=#{vm&.id}. Its manufacturer is #{vm&.manufacturer&.name}. Returning VM."
            return vm
          else
            # Rails.logger.debug "[RVM] target_mfr was nil. Falling back to find existing, non-(ND) VM for vaccine '#{vaccine.name}' in chain '#{chain_arg_passed_in.name}'..."
            vm = vaccine.vaccine_manufacturers
                        .joins(:manufacturer)
                        .where(chain: chain_arg_passed_in)
                        .where.not(manufacturers: { name: ::Manufacturer::UNAVAILABLE_MANUFACTURER })
                        .first
            if vm
              # Rails.logger.debug "[RVM] Fallback found existing non-(ND) VM: ID=#{vm.id}, Mfr: '#{vm.manufacturer&.name}'. Returning VM."
              return vm
            else
              # Rails.logger.debug "[RVM] Fallback: No existing non-(ND) VM found for vaccine '#{vaccine.name}' in chain '#{chain_arg_passed_in.name}'. Returning nil."
              Rails.logger.warn "[RVMHelper] CRITICAL: Cannot resolve a specific VM for Vaccine '#{vaccine.name}'. No explicit, suitable default, or existing non-(ND) VM found in chain."
              return nil
            end
          end
        rescue ActiveRecord::RecordInvalid => e_invalid
          Rails.logger.error "[RVMHelper] ActiveRecord::RecordInvalid creating/finding VM for Vaccine '#{vaccine.name}', Mfr '#{target_mfr&.name}', Chain '#{chain_arg_passed_in&.name}': #{e_invalid.message}"
          return nil
        rescue StandardError => e # Catch-all for this helper method
          Rails.logger.error "[RVMHelper] Outer unexpected error in resolve_vaccine_manufacturer (Vaccine: '#{vaccine.name}'): #{e.class.name} - #{e.message}\n#{e.backtrace.first(5).join("\n")}"
          return nil
        end

        def format_external_batch_manufacturer(batch, manufacturer_name)
          parts = []
          parts << "Lote: #{batch}" if batch.present?
          actual_mfr_name = (manufacturer_name == ::GeminiApiService::DEFAULT_VALUE_FOR_MISSING_FIELD) ? nil : manufacturer_name
          parts << "Fab: #{actual_mfr_name}" if actual_mfr_name.present?
          parts.join(' / ').presence || ::GeminiApiService::DEFAULT_VALUE_FOR_MISSING_FIELD
        end

      end # End class
    end
  end
end