# File Path: app/graphql/graph/types/mutations/process_base64_file.rb
require 'base64'
module Graph
  module Types
    module Mutations
      class ProcessBase64File < ::Graph::BaseMutation
        description "Uploads a Base64 encoded file for a patient, processes it with Gemini API (with context of active vaccines, existing shots, and possible doses), and returns the result."

        input_type Graph::Types::ProcessBase64FileInputType
        field :payload, Graph::Types::ProcessGeminiFilePayloadType, null: true

        def resolve(file_content_base64:, original_filename:, content_type:, patient_id:, **other_input_args)
          Rails.logger.info "[ProcessBase64File] Received request for patient_id: #{patient_id}, file: #{original_filename}"

          # --- Sanity Checks for input parameters ---
          unless file_content_base64.present? && original_filename.present? && content_type.present?
            missing_fields = []
            missing_fields << "file content" unless file_content_base64.present?
            missing_fields << "original filename" unless original_filename.present?
            missing_fields << "content type" unless content_type.present?
            error_message = "Missing required fields: #{missing_fields.join(', ')}."
            Rails.logger.warn "[ProcessBase64File] #{error_message} for patient_id: #{patient_id}"
            return { payload: { success: false, gemini_response: nil, errors: [error_message] } }
          end

          begin
            # --- 1. Prepare Base64 Content ---
            cleaned_base64_content = file_content_base64.sub(/^data:.+;base64,/, '')
            if cleaned_base64_content.blank?
              error_message = if file_content_base64.present?
                                "Invalid Base64 data: empty after removing data URI prefix."
                              else
                                "Base64 content is empty."
                              end
              Rails.logger.warn "[ProcessBase64File] #{error_message} for patient_id: #{patient_id}, original_filename: #{original_filename}"
              return { payload: { success: false, gemini_response: nil, errors: [error_message] } }
            end
            Rails.logger.debug "[ProcessBase64File] Prepared cleaned Base64 content for patient_id: #{patient_id}"
            # --- End Prepare Base64 Content ---

            # --- 2. Fetch Patient Context: Active Vaccines (Chain) & Existing Shots (Patient) ---
            actual_patient = find_node(patient_id)&.or_nil # Get Patient AR object (or nil if Nothing)

            active_vaccines = [] # Initialize default
            existing_shots_data = []  # Initialize default
            possible_doses_by_vaccine = {} # <<<< NEW: Initialize hash for dose context


            if actual_patient
              # Fetch full vaccine objects, eager loading the rule association
              active_vaccines = actual_patient.chain&.vaccines&.where(active: true) || []

              if active_vaccines.any?
                Rails.logger.info "[ProcessBase64File] Found #{active_vaccines.count} active vaccines for patient's chain."

                # Derive dose context from the vaccine objects
                active_vaccines.each do |vaccine|
                  # Use the confirmed `all_doses` method.
                  # Use safe navigation (&.) in case a rule exists but has no calendar.
                  all_doses = vaccine.rule&.calendar&.all_doses
                      
                  if all_doses.present?
                    possible_doses_by_vaccine[vaccine.name] = all_doses.map(&:label).uniq
                  end
                end
                Rails.logger.info "[ProcessBase64File] Fetched dose context for #{possible_doses_by_vaccine.keys.count} vaccines."
              end


              # Fetch existing shot records for THIS patient
              shots_to_process = actual_patient.shots.includes(
                :vaccine_manufacturer => [:vaccine, :manufacturer]
                # Consider adding more includes if your `shot.dose` method makes further DB calls
              )
              
              existing_shots_data = shots_to_process.map do |shot|
                current_vaccine_name = shot.vaccine_name
                current_manufacturer_name = shot.vaccine_manufacturer&.manufacturer&.name
                dose_object = shot.dose
                dose_display_text = if dose_object
                                      dose_object.try(:label) || dose_object.try(:name) || dose_object.to_s
                                    else
                                      shot.migrated_dose
                                    end
                {
                  vaccine_name: current_vaccine_name || "(Vacina não registrada no sistema)",
                  application_date: shot.date&.strftime('%d/%m/%Y') || "(Data não registrada no sistema)",
                  manufacturer: current_manufacturer_name || "(Fabricante não registrado no sistema)",
                  batch: shot.batch || "(Lote não registrado no sistema)",
                  dose: dose_display_text || "(Dose não registrada no sistema)"
                }
              end.compact

              if existing_shots_data.any?
                Rails.logger.info "[ProcessBase64File] Fetched #{existing_shots_data.count} existing shot records for patient #{patient_id}."
              else
                Rails.logger.info "[ProcessBase64File] No existing shot records found for patient #{patient_id}."
              end

            else # Patient not found or unwrapping resulted in nil
              if patient_maybe.is_a?(::Maybe::Nothing)
                Rails.logger.warn "[ProcessBase64File] Patient not found (Maybe::Nothing) with ID: #{patient_id}."
              elsif patient_maybe.is_a?(::Maybe::Some) # and or_nil returned nil
                Rails.logger.warn "[ProcessBase64File] Unwrapped patient from Maybe::Some but it resulted in nil for ID: #{patient_id}."
              else # find_node returned something else (e.g., direct nil, though Maybe() should prevent this)
                Rails.logger.error "[ProcessBase64File] find_node returned an unexpected value for patient ID #{patient_id}: #{patient_maybe.inspect}"
              end
              # active_vaccines and existing_shots_data remain [] as initialized
            end
            # --- End Data Fetching ---

            # --- Debugging Point (Uncomment if needed) ---
            # puts "DEBUG: [ProcessBase64File] actual_patient: #{actual_patient.inspect if actual_patient}"
            # puts "DEBUG: [ProcessBase64File] active_vaccines for prompt: #{active_vaccines.inspect}"
            # puts "DEBUG: [ProcessBase64File] existing_shots_data for prompt: #{existing_shots_data.inspect}"
            # binding.pry if defined?(binding) && Rails.env.development?
            # --- End Debugging Point ---

            # --- 3. Call Gemini Service ---
            gemini_service = ::GeminiApiService.new
            service_response = gemini_service.process_file(
              image_base64_data: cleaned_base64_content,
              original_filename: original_filename,
              content_type: content_type,
              known_active_vaccines: active_vaccines.map(&:name),
              existing_shot_records: existing_shots_data,
              possible_doses_by_vaccine: possible_doses_by_vaccine
            )

            # --- 4. Process Service Response ---
            if service_response.success?
              Rails.logger.info "[ProcessBase64File] Successfully processed file with Gemini for patient_id: #{patient_id}, file: #{original_filename}"
              { payload: { success: true, gemini_response: service_response.data, errors: nil } }
            else
              Rails.logger.warn "[ProcessBase64File] GeminiApiService failed for patient_id: #{patient_id}, file: #{original_filename}. Errors: #{service_response.errors.join(', ')}"
              { payload: { success: false, gemini_response: nil, errors: service_response.errors } }
            end

          rescue ArgumentError => e
            Rails.logger.error "[ProcessBase64File] Argument Error for patient #{patient_id}, mutation #{self.class.name}: #{e.message}"
            { payload: { success: false, gemini_response: nil, errors: ["Invalid argument during processing: #{e.message}"] } }
          rescue StandardError => e
            Rails.logger.error "[ProcessBase64File] Unexpected Processing Error for patient #{patient_id}, mutation #{self.class.name}: #{e.class.name} - #{e.message}\n#{e.backtrace.first(10).join("\n")}"
            { payload: { success: false, gemini_response: nil, errors: ["An unexpected error occurred: #{e.message}"] } }
          end
        end
      end
    end
  end
end