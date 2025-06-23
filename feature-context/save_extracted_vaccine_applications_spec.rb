# spec/graphql/mutations/save_extracted_vaccine_applications_spec.rb
require 'rails_helper'

RSpec.describe Graph::Types::Mutations::SaveExtractedVaccineApplications, type: :request do
  let(:mutation_query) do
    <<~GQL
      mutation($input: SaveExtractedVaccineApplicationsInput!) {
        saveExtractedVaccineApplications(input: $input) {
          payload {
            overallSuccess
            processedApplications {
              inputIndex
              success
              shot {
                id
                date
                dose { # We can now query the dose
                  id
                  label
                }
                observations
                batch # This field in ExternalShotType is configured to return external_batch_and_manufacturer
                vaccineManufacturer {
                  vaccine {
                    name
                  }
                  manufacturer {
                    name
                  }
                }
              }
              errors
            }
          }
        }
      }
    GQL
  end

  let!(:chain) { create(:chain) }
  let!(:clinic) { create(:clinic, chain: chain) }
  let!(:patient_record) { create(:patient, chain: chain, clinic: clinic) }
  
  let!(:patient_gql_type) { Graph::Schema.types["Patient"] }
  let!(:vaccine_gql_type) { Graph::Schema.types["Vaccine"] }
  let!(:dose_gql_type) { Graph::Schema.types["Dose"] } 
  let!(:external_shot_gql_type_name) { Graph::Types::ExternalShotType.graphql_name }

  let!(:vaccine1_record) { create(:vaccine, name: "TestVax1", chain: chain, active: true) }
  let!(:manufacturer1) { create(:manufacturer, name: "TestMfr1", chain: chain) }
  let!(:vm1) { create(:vaccine_manufacturer, vaccine: vaccine1_record, manufacturer: manufacturer1, chain: chain) }

  let!(:vaccine2_record) { create(:vaccine, name: "TestVax2", chain: chain, active: true) }
  let!(:manufacturer2) { create(:manufacturer, name: "TestMfr2", chain: chain) }
  let!(:vm2) { create(:vaccine_manufacturer, vaccine: vaccine2_record, manufacturer: manufacturer2, chain: chain) }

  let(:context_overrides) { {} }
  let(:mutation_context) { netvacinas_context({ current_chain: chain, current_clinic: clinic }.merge(context_overrides)) }

  def generate_custom_gql_id(object, type_definition)
    Graph::Schema.id_from_object(object, type_definition, mutation_context)
  end

  def expected_external_batch_manufacturer_string(batch, manufacturer_name)
    parts = []
    parts << "Lote: #{batch}" if batch.present?
    actual_mfr_name = (manufacturer_name == ::GeminiApiService::DEFAULT_VALUE_FOR_MISSING_FIELD || manufacturer_name.blank?) ? nil : manufacturer_name
    parts << "Fab: #{actual_mfr_name}" if actual_mfr_name.present?
    parts.join(' / ').presence || ::GeminiApiService::DEFAULT_VALUE_FOR_MISSING_FIELD
  end

  def perform_mutation(variables)
    result = Graph::Schema.execute(mutation_query, variables: variables, context: mutation_context).to_h
    # Uncomment for debugging:
    # if RSpec.current_example.metadata[:print_gql_result] || true # to print all
    #   puts "\n>>>>>>>> Raw GraphQL Result for: #{RSpec.current_example.full_description}"
    #   puts result.inspect
    #   puts ">>>>>>>>\n"
    # end
    result
  end

  describe "resolve" do
    before(:each) do
      @suggest_use_case_instance = instance_double(SuggestUseCase)
      allow(SuggestUseCase).to receive(:new).and_return(@suggest_use_case_instance)
      allow(@suggest_use_case_instance).to receive(:call).and_return(true)
    end

    context "when all applications are valid and processed successfully" do
      let(:application1_attrs) { { vaccineId: generate_custom_gql_id(vaccine1_record, vaccine_gql_type), applicationDate: "2024-01-15", manufacturerName: manufacturer1.name, batchNumber: "B001", observations: "App1 Obs" } }
      let(:application2_attrs) { { vaccineId: generate_custom_gql_id(vaccine2_record, vaccine_gql_type), applicationDate: "2024-02-20", manufacturerName: manufacturer2.name, batchNumber: "B002", observations: "App2 Obs" } }
      let(:mutation_input_vars) do
        { input: { patientId: generate_custom_gql_id(patient_record, patient_gql_type), applications: [application1_attrs, application2_attrs] } }
      end

      it "returns overallSuccess true" do
        result = perform_mutation(mutation_input_vars)
        payload = result.dig("data", "saveExtractedVaccineApplications", "payload")
        expect(payload).not_to be_nil, "Payload was nil. GraphQL result: #{result.inspect}"
        expect(payload["overallSuccess"]).to be true
      end

      it "returns a successful result for each processed application" do
        result = perform_mutation(mutation_input_vars)
        payload = result.dig("data", "saveExtractedVaccineApplications", "payload")
        expect(payload).not_to be_nil, "Payload was nil. GraphQL result: #{result.inspect}"
        processed_apps = payload["processedApplications"]
        
        expect(processed_apps.count).to eq(2)
        
        app1_result = processed_apps.find { |r| r["inputIndex"] == 0 }
        expect(app1_result["success"]).to be true
        expect(app1_result["errors"]).to be_nil
        expect(app1_result["shot"]).to be_present
        expect(app1_result["shot"]["batch"]).to eq(expected_external_batch_manufacturer_string("B001", manufacturer1.name))

        app2_result = processed_apps.find { |r| r["inputIndex"] == 1 }
        expect(app2_result["success"]).to be true
        expect(app2_result["errors"]).to be_nil
        expect(app2_result["shot"]).to be_present
        expect(app2_result["shot"]["batch"]).to eq(expected_external_batch_manufacturer_string("B002", manufacturer2.name))
      end

      it "creates the correct number of Shot records" do
        expect { perform_mutation(mutation_input_vars) }.to change { Shot.count }.by(2)
      end

      it "persists the shots with correct attributes" do
        perform_mutation(mutation_input_vars)
        shot1 = Shot.joins(vaccine_manufacturer: :vaccine)
                    .find_by!(patient: patient_record, batch: "B001", vaccines: { name: "TestVax1" })
        shot2 = Shot.joins(vaccine_manufacturer: :vaccine)
                    .find_by!(patient: patient_record, batch: "B002", vaccines: { name: "TestVax2" })

        expect(shot1.vaccine_manufacturer.vaccine.name).to eq("TestVax1")
        expect(shot1.vaccine_manufacturer.manufacturer.name).to eq(manufacturer1.name)
        expect(shot1.date.to_date).to eq(Date.new(2024, 1, 15))
        expect(shot1.observations).to eq("App1 Obs")
        expect(shot1.external).to be true
        expect(shot1.status).to eq(Shot::Status::APPLIED)
        expect(shot1.registered_by).to eq(mutation_context[:current_user])
        expect(shot1.batch).to eq("B001")
        expect(shot1.external_batch_and_manufacturer).to eq(expected_external_batch_manufacturer_string("B001", manufacturer1.name))

        expect(shot2.vaccine_manufacturer.vaccine.name).to eq("TestVax2")
        expect(shot2.observations).to eq("App2 Obs")
        expect(shot2.date.to_date).to eq(Date.new(2024, 2, 20))
        expect(shot2.batch).to eq("B002")
        expect(shot2.external_batch_and_manufacturer).to eq(expected_external_batch_manufacturer_string("B002", manufacturer2.name))
      end

      it "returns the created shots in the payload with custom IDs" do
        result = perform_mutation(mutation_input_vars)
        payload = result.dig("data", "saveExtractedVaccineApplications", "payload")
        expect(payload).not_to be_nil, "Payload was nil. GraphQL result: #{result.inspect}"
        processed_apps = payload["processedApplications"]
        
        shot1_db = Shot.joins(vaccine_manufacturer: :vaccine).find_by!(patient: patient_record, batch: "B001", vaccines: { name: "TestVax1" })
        shot2_db = Shot.joins(vaccine_manufacturer: :vaccine).find_by!(patient: patient_record, batch: "B002", vaccines: { name: "TestVax2" })
        
        app1_shot_payload = processed_apps.find { |r| r["inputIndex"] == 0 }["shot"]
        expect(app1_shot_payload["id"]).to eq("#{external_shot_gql_type_name}-#{shot1_db.id}")

        app2_shot_payload = processed_apps.find { |r| r["inputIndex"] == 1 }["shot"]
        expect(app2_shot_payload["id"]).to eq("#{external_shot_gql_type_name}-#{shot2_db.id}")
      end

      it "calls SuggestUseCase for the patient of each created shot" do
        perform_mutation(mutation_input_vars)
        expect(@suggest_use_case_instance).to have_received(:call).with(patient_record).twice
      end
    end

    context "when one application fails (e.g., invalid vaccineId) and others succeed" do
      let(:valid_app1_attrs) { { vaccineId: generate_custom_gql_id(vaccine1_record, vaccine_gql_type), applicationDate: "2024-03-01", manufacturerName: manufacturer1.name, batchNumber: "B003_PARTIAL" } }
      let(:invalid_app_attrs) { { vaccineId: "#{vaccine_gql_type.graphql_name}-invalid999", applicationDate: "2024-03-10", manufacturerName: "AnyMfr" } }
      let(:valid_app2_attrs) { { vaccineId: generate_custom_gql_id(vaccine2_record, vaccine_gql_type), applicationDate: "2024-03-15", manufacturerName: manufacturer2.name, batchNumber: "B004_PARTIAL" } }
      let(:mutation_input_vars) do
        { input: { patientId: generate_custom_gql_id(patient_record, patient_gql_type), applications: [valid_app1_attrs, invalid_app_attrs, valid_app2_attrs] } }
      end

      it "returns overallSuccess false" do
        result = perform_mutation(mutation_input_vars)
        payload = result.dig("data", "saveExtractedVaccineApplications", "payload")
        expect(payload).not_to be_nil, "Payload was nil. GraphQL result: #{result.inspect}"
        expect(payload["overallSuccess"]).to be false
      end

      it "returns a result for each application, marking success/failure accordingly" do
        result = perform_mutation(mutation_input_vars)
        payload = result.dig("data", "saveExtractedVaccineApplications", "payload")
        expect(payload).not_to be_nil, "Payload was nil. GraphQL result: #{result.inspect}"
        processed_apps = payload["processedApplications"]
        
        expect(processed_apps.count).to eq(3)

        app1_result = processed_apps.find { |r| r["inputIndex"] == 0 }
        expect(app1_result["success"]).to be true
        expect(app1_result["shot"]).to be_present
        expect(app1_result["errors"]).to be_nil

        app2_result = processed_apps.find { |r| r["inputIndex"] == 1 }
        expect(app2_result["success"]).to be false
        expect(app2_result["shot"]).to be_nil
        expect(app2_result["errors"]).to include(match(/Vacina inválida.*ID: '#{invalid_app_attrs[:vaccineId]}'/))

        app3_result = processed_apps.find { |r| r["inputIndex"] == 2 }
        expect(app3_result["success"]).to be true
        expect(app3_result["shot"]).to be_present
        expect(app3_result["errors"]).to be_nil
      end

      it "creates Shot records only for the successful applications" do
        expect { perform_mutation(mutation_input_vars) }.to change { Shot.count }.by(2)
        expect(Shot.find_by(batch: "B003_PARTIAL", patient: patient_record)).to be_present
        expect(Shot.find_by(batch: "B004_PARTIAL", patient: patient_record)).to be_present
      end

      it "calls SuggestUseCase only for successfully created shots" do
        perform_mutation(mutation_input_vars)
        expect(@suggest_use_case_instance).to have_received(:call).with(patient_record).twice
      end
    end

    context "when all applications fail" do
      let(:invalid_vaccine_id1) { "#{vaccine_gql_type.graphql_name}-invalid777" }
      let(:invalid_vaccine_id2) { "#{vaccine_gql_type.graphql_name}-invalid888" }
      let(:mutation_input_vars) do
        { input: { patientId: generate_custom_gql_id(patient_record, patient_gql_type), applications: [
              { vaccineId: invalid_vaccine_id1, applicationDate: "2024-04-01" },
              { vaccineId: invalid_vaccine_id2, applicationDate: "2024-04-05" }
            ]}}
      end

      it "returns overallSuccess false" do
        result = perform_mutation(mutation_input_vars)
        payload = result.dig("data", "saveExtractedVaccineApplications", "payload")
        expect(payload).not_to be_nil, "Payload was nil. GraphQL result: #{result.inspect}"
        expect(payload["overallSuccess"]).to be false
      end

      it "returns a failed result for each application" do
        result = perform_mutation(mutation_input_vars)
        payload = result.dig("data", "saveExtractedVaccineApplications", "payload")
        expect(payload).not_to be_nil, "Payload was nil. GraphQL result: #{result.inspect}"
        processed_apps = payload["processedApplications"]
        expect(processed_apps.count).to eq(2)
        processed_apps.each_with_index do |app_result, i|
          expect(app_result["success"]).to be false
          expect(app_result["shot"]).to be_nil
          expect(app_result["errors"]).not_to be_empty
          expect(app_result["inputIndex"]).to eq(i)
        end
      end

      it "does not create any Shot records" do
        expect { perform_mutation(mutation_input_vars) }.not_to change { Shot.count }
      end

      it "does not call SuggestUseCase" do
        perform_mutation(mutation_input_vars)
        expect(@suggest_use_case_instance).not_to have_received(:call)
      end
    end
    
    context "when patient ID is invalid (as top-level failure)" do
      let(:mutation_input_vars) do
        { input: { patientId: "#{patient_gql_type.graphql_name}-invalid999", applications: [
              { vaccineId: generate_custom_gql_id(vaccine1_record, vaccine_gql_type), applicationDate: "2024-01-15" }
        ]}}
      end

      it "returns overallSuccess false and an error message for each application input" do
        result = perform_mutation(mutation_input_vars)
        payload = result.dig("data", "saveExtractedVaccineApplications", "payload")
        expect(payload).not_to be_nil, "Payload was nil. GraphQL result: #{result.inspect}"
        processed_apps = payload["processedApplications"]
        
        expect(payload["overallSuccess"]).to be false
        expect(processed_apps.count).to eq(1) 
        processed_apps.each do |app_result|
            expect(app_result["success"]).to be false
            expect(app_result["shot"]).to be_nil
            expect(app_result["errors"]).to include("Paciente não encontrado.")
        end
      end

      it "does not create any Shot records" do
        expect { perform_mutation(mutation_input_vars) }.not_to change { Shot.count }
      end
    end

    context "when applications input is an empty array" do
      let(:mutation_input_vars) do
        { input: { patientId: generate_custom_gql_id(patient_record, patient_gql_type), applications: [] } }
      end

      it "returns overallSuccess false and an empty processedApplications array" do
        result = perform_mutation(mutation_input_vars)
        payload = result.dig("data", "saveExtractedVaccineApplications", "payload")
        expect(payload).not_to be_nil, "Payload was nil. GraphQL result: #{result.inspect}"
        
        expect(payload["overallSuccess"]).to be false
        expect(payload["processedApplications"]).to be_empty 
      end

      it "does not create any Shot records" do
        expect { perform_mutation(mutation_input_vars) }.not_to change { Shot.count }
      end
    end

    context "when handling manufacturer resolution scenarios" do
      let!(:manufacturer_for_default_tests) { create(:manufacturer, name: "DefaultMfrX", chain: chain) }
      let!(:manufacturer_for_other_vm_tests) { create(:manufacturer, name: "OtherMfrY", chain: chain) }
      let!(:manufacturer_nd_obj) { Manufacturer.find_by(name: Manufacturer::UNAVAILABLE_MANUFACTURER, chain: chain) || create(:manufacturer, name: Manufacturer::UNAVAILABLE_MANUFACTURER, chain: chain) }

      let!(:vaccine_for_default_mfr_test) { create(:vaccine, name: "VaxWithDefaultLogic", chain: chain, active: true) }
      let!(:vaccine_for_existing_vm_test) { create(:vaccine, name: "VaxForExistingVMTest", chain: chain, active: true) }
      let!(:vaccine_for_no_vm_resolve_test) { create(:vaccine, name: "VaxAloneForNoResolve", chain: chain, active: true) }
      
      before(:each) do
        # Setup for Scenario 2c
        VaccineManufacturer.where(vaccine: vaccine_for_existing_vm_test, chain: chain).destroy_all
        create(:vaccine_manufacturer, vaccine: vaccine_for_existing_vm_test, manufacturer: manufacturer_for_other_vm_tests, chain: chain)
        
        # Setup for Scenario 2d
        allow(vaccine_for_no_vm_resolve_test).to receive(:default_manufacturer).and_return(nil)
        VaccineManufacturer.where(vaccine: vaccine_for_no_vm_resolve_test, chain: chain)
                           .where.not(manufacturer: manufacturer_nd_obj) 
                           .destroy_all
      end

      context "Scenario 2a: manufacturerName is blank/default, and STUBBED vaccine.default_manufacturer is used" do
        let(:mutation_input_vars) do
          { input: { patientId: generate_custom_gql_id(patient_record, patient_gql_type), applications: [
            { vaccineId: generate_custom_gql_id(vaccine_for_default_mfr_test, vaccine_gql_type), applicationDate: "2024-06-01", manufacturerName: nil, batchNumber: "B_S2A_DEFAULT_MFR" }
          ]}}
        end

        before do 
          allow(Graph::Schema).to receive(:object_from_id).and_call_original
          allow(Graph::Schema).to receive(:object_from_id)
            .with(generate_custom_gql_id(vaccine_for_default_mfr_test, vaccine_gql_type), anything)
            .and_return(vaccine_for_default_mfr_test)
          allow(vaccine_for_default_mfr_test).to receive(:default_manufacturer).and_return(manufacturer_for_default_tests)
        end

        it "successfully saves the shot using the STUBBED vaccine's default manufacturer ('DefaultMfrX')" do
          expect { perform_mutation(mutation_input_vars) }.to change { Shot.count }.by(1)
          result = perform_mutation(mutation_input_vars) 
          payload = result.dig("data", "saveExtractedVaccineApplications", "payload")
          
          expect(payload["overallSuccess"]).to be true
          app_result = payload.dig("processedApplications", 0)
          expect(app_result).not_to be_nil
          expect(app_result["success"]).to be true
          expect(app_result.dig("shot", "vaccineManufacturer", "manufacturer", "name")).to eq("DefaultMfrX")
          
          saved_shot = Shot.find_by!(batch: "B_S2A_DEFAULT_MFR", patient: patient_record)
          expect(saved_shot.vaccine_manufacturer.manufacturer.name).to eq("DefaultMfrX")
        end
      end

      context "Scenario 2b: manufacturerName provided but not found, STUBBED vaccine.default_manufacturer is used" do
        let(:mutation_input_vars) do
          { input: { patientId: generate_custom_gql_id(patient_record, patient_gql_type), applications: [
            { vaccineId: generate_custom_gql_id(vaccine_for_default_mfr_test, vaccine_gql_type), applicationDate: "2024-06-02", manufacturerName: "NonExistentMfrName", batchNumber: "B_S2B_NONEXIST_FALLBACK" }
          ]}}
        end
        
        before do 
          allow(Graph::Schema).to receive(:object_from_id).and_call_original
          allow(Graph::Schema).to receive(:object_from_id)
            .with(generate_custom_gql_id(vaccine_for_default_mfr_test, vaccine_gql_type), anything)
            .and_return(vaccine_for_default_mfr_test)
          allow(vaccine_for_default_mfr_test).to receive(:default_manufacturer).and_return(manufacturer_for_default_tests)
        end

        it "successfully saves using the STUBBED vaccine's default manufacturer ('DefaultMfrX')" do
          expect { perform_mutation(mutation_input_vars) }.to change { Shot.count }.by(1)
          result = perform_mutation(mutation_input_vars)
          payload = result.dig("data", "saveExtractedVaccineApplications", "payload")
          expect(payload["overallSuccess"]).to be true
          app_result = payload.dig("processedApplications", 0)
          expect(app_result).not_to be_nil
          expect(app_result["success"]).to be true
          expect(app_result.dig("shot", "vaccineManufacturer", "manufacturer", "name")).to eq("DefaultMfrX")
          
          saved_shot = Shot.find_by!(batch: "B_S2B_NONEXIST_FALLBACK", patient: patient_record)
          expect(saved_shot.vaccine_manufacturer.manufacturer.name).to eq("DefaultMfrX")
        end
      end
      
      context "Scenario 2c: No manufacturerName, no default_manufacturer, but an existing VM for vaccine/chain is used" do
        let(:mutation_input_vars) do
          { input: { patientId: generate_custom_gql_id(patient_record, patient_gql_type), applications: [
            { vaccineId: generate_custom_gql_id(vaccine_for_existing_vm_test, vaccine_gql_type), applicationDate: "2024-06-03", manufacturerName: nil, batchNumber: "B_S2C_EXISTING_VM" }
          ]}}
        end

        before do
            allow(Graph::Schema).to receive(:object_from_id).and_call_original
            allow(Graph::Schema).to receive(:object_from_id)
              .with(generate_custom_gql_id(vaccine_for_existing_vm_test, vaccine_gql_type), anything)
              .and_return(vaccine_for_existing_vm_test)
            allow(vaccine_for_existing_vm_test).to receive(:default_manufacturer).and_return(nil)
        end

        it "successfully saves using the first available VaccineManufacturer ('OtherMfrY')" do
          expect { perform_mutation(mutation_input_vars) }.to change { Shot.count }.by(1)
          result = perform_mutation(mutation_input_vars)
          payload = result.dig("data", "saveExtractedVaccineApplications", "payload")
          expect(payload["overallSuccess"]).to be true
          app_result = payload.dig("processedApplications", 0)
          expect(app_result).not_to be_nil
          expect(app_result["success"]).to be true
          expect(app_result.dig("shot", "vaccineManufacturer", "manufacturer", "name")).to eq("OtherMfrY")

          saved_shot = Shot.find_by!(batch: "B_S2C_EXISTING_VM", patient: patient_record)
          expect(saved_shot.vaccine_manufacturer.manufacturer.name).to eq("OtherMfrY")
        end
      end

      context "Scenario 2d: NO VaccineManufacturer can be resolved (no name, no default, no existing VM for this specific test vaccine)" do
        let(:mutation_input_vars) do
          { input: { patientId: generate_custom_gql_id(patient_record, patient_gql_type), applications: [
            { vaccineId: generate_custom_gql_id(vaccine_for_no_vm_resolve_test, vaccine_gql_type), applicationDate: "2024-06-04", manufacturerName: "UnknownOrNonExistent", batchNumber: "B_S2D_NO_VM_RESOLVE" }
          ]}}
        end

        before do
            allow(Graph::Schema).to receive(:object_from_id).and_call_original
            allow(Graph::Schema).to receive(:object_from_id)
              .with(generate_custom_gql_id(vaccine_for_no_vm_resolve_test, vaccine_gql_type), anything)
              .and_return(vaccine_for_no_vm_resolve_test)
            # :default_manufacturer is already stubbed to nil for vaccine_for_no_vm_resolve_test by the outer before block
        end

        it "fails to save the application and reports an error" do
          expect { perform_mutation(mutation_input_vars) }.not_to change { Shot.count }
          result = perform_mutation(mutation_input_vars)
          payload = result.dig("data", "saveExtractedVaccineApplications", "payload")
          
          expect(payload["overallSuccess"]).to be false
          app_result = payload.dig("processedApplications", 0)
          expect(app_result).not_to be_nil
          expect(app_result["success"]).to be false
          expect(app_result["shot"]).to be_nil
          expect(app_result["errors"].first).to match(/Não foi possível determinar\/criar o produto Vacina\/Fabricante.*VaxAloneForNoResolve/)
        end
      end
    end

    context "when a shot model validation fails for one application" do
      let(:valid_app_attrs) { { vaccineId: generate_custom_gql_id(vaccine1_record, vaccine_gql_type), applicationDate: "2024-05-01", manufacturerName: manufacturer1.name, batchNumber: "VALID_BATCH_MODEL_FAIL", observations: "Valid App Obs" } }
      let(:app_to_fail_save_attrs) { { vaccineId: generate_custom_gql_id(vaccine2_record, vaccine_gql_type), applicationDate: "2024-05-05", manufacturerName: manufacturer2.name, batchNumber: "FAIL_BATCH_MODEL_FAIL", observations: "App to Fail Obs" } }
      let(:mutation_input_vars) do
        { input: { patientId: generate_custom_gql_id(patient_record, patient_gql_type), applications: [valid_app_attrs, app_to_fail_save_attrs] } }
      end

      before do
        @failing_shot_double = instance_double(
          Shot,
          save: false, 
          errors: double("errors_double", full_messages: ["Mocked model validation error from double"]),
          patient: patient_record, 
          vaccine_manufacturer: vm2, 
          date: Graph::Types::LocalDateType.coerce_input(app_to_fail_save_attrs[:applicationDate], mutation_context),
          batch: app_to_fail_save_attrs[:batchNumber],
          observations: app_to_fail_save_attrs[:observations],
          external: true, 
          status: Shot::Status::APPLIED,
          registered_by: mutation_context[:current_user],
          external_batch_and_manufacturer: expected_external_batch_manufacturer_string(
            app_to_fail_save_attrs[:batchNumber], 
            app_to_fail_save_attrs[:manufacturerName]
          ),
          # Ensure all attributes expected by the Shot model for `new` are present or stubbed
          # if not covered by the attributes hash passed to `Shot.new` in the mutation.
          dose_id: nil, 
          skip_dose_validation: true 
        )
        allow(@failing_shot_double).to receive(:attributes=).with(anything) # Handles mass assignment
        allow(@failing_shot_double).to receive(:valid?).and_return(false) # Explicitly make it invalid

        allow(Shot).to receive(:new).and_call_original # Allow other :new calls to proceed
        allow(Shot).to receive(:new)
          .with(hash_including(batch: app_to_fail_save_attrs[:batchNumber])) # Match the failing shot's attributes
          .and_return(@failing_shot_double)
      end

      it "marks the specific application as failed with model errors" do
        result = perform_mutation(mutation_input_vars)
        payload = result.dig("data", "saveExtractedVaccineApplications", "payload")
        expect(payload).not_to be_nil, "Payload was nil. GraphQL result: #{result.inspect}"
        processed_apps = payload["processedApplications"]

        expect(payload["overallSuccess"]).to be false
        
        successful_app_result = processed_apps.find { |r| r["inputIndex"] == 0 }
        expect(successful_app_result["success"]).to be true
        expect(successful_app_result["shot"]).to be_present
        # ===> UPDATED BATCH EXPECTATION for the successful shot's payload <===
        expect(successful_app_result["shot"]["batch"]).to eq(
          expected_external_batch_manufacturer_string(valid_app_attrs[:batchNumber], valid_app_attrs[:manufacturerName])
        )   
        expect(successful_app_result["errors"]).to be_nil

        failed_app_result = processed_apps.find { |r| r["inputIndex"] == 1 }
        expect(failed_app_result["success"]).to be false
        expect(failed_app_result["shot"]).to be_nil 
        expect(failed_app_result["errors"]).to include("Mocked model validation error from double")
      end

      it "only saves the valid shot" do
        initial_shot_count = Shot.count
        perform_mutation(mutation_input_vars)
        expect(Shot.count).to eq(initial_shot_count + 1)

        expect(Shot.find_by(batch: valid_app_attrs[:batchNumber])).to be_present
        expect(Shot.find_by(batch: app_to_fail_save_attrs[:batchNumber])).not_to be_present
      end
      
      it "calls SuggestUseCase only for the successfully saved shot" do
        perform_mutation(mutation_input_vars)
        expect(@suggest_use_case_instance).to have_received(:call).with(patient_record).once
      end
    end

    context "when handling specific manufacturer name inputs" do
      let!(:vaccine_regular) { create(:vaccine, name: "RegularVax", chain: chain, active: true) }
      let!(:mfr_real) { create(:manufacturer, name: "RealMfr", chain: chain) }
      let!(:mfr_nd) { Manufacturer.find_by(name: Manufacturer::UNAVAILABLE_MANUFACTURER, chain: chain) || create(:manufacturer, name: Manufacturer::UNAVAILABLE_MANUFACTURER, chain: chain) }

      before do
        # No default manufacturer for vaccine_regular for these specific tests
        allow(vaccine_regular).to receive(:default_manufacturer).and_return(nil)
        # Ensure no pre-existing VM for vaccine_regular and mfr_real unless intended by a specific test
        VaccineManufacturer.where(vaccine: vaccine_regular, manufacturer: mfr_real, chain: chain).destroy_all
      end

      context "when manufacturerName input is the (ND) placeholder string" do
        let(:mutation_input_vars) do
          { input: { patientId: generate_custom_gql_id(patient_record, patient_gql_type), applications: [
            { vaccineId: generate_custom_gql_id(vaccine_regular, vaccine_gql_type), applicationDate: "2024-07-01", 
              manufacturerName: ::GeminiApiService::DEFAULT_VALUE_FOR_MISSING_FIELD, # Input is "(Não especificado)"
              batchNumber: "B_ND_INPUT" }
          ]}}
        end

        it "attempts to use a fallback (e.g., existing non-ND VM or fails if none)" do
          # This test depends on whether a VM with (ND) manufacturer should be created or if it should always fallback.
          # Current resolve_vaccine_manufacturer logic:
          # 1. find_manufacturer_by_name_or_alias gets nil because name_str == DEFAULT_VALUE_FOR_MISSING_FIELD.
          # 2. target_mfr becomes nil.
          # 3. Falls back to finding an existing, non-(ND) VM. If none, returns nil.
          
          # Let's assume no other VM exists for vaccine_regular
          VaccineManufacturer.where(vaccine: vaccine_regular, chain: chain).destroy_all

          result = perform_mutation(mutation_input_vars)
          payload = result.dig("data", "saveExtractedVaccineApplications", "payload")
          expect(payload["overallSuccess"]).to be false # Because VM resolution will fail
          app_result = payload.dig("processedApplications", 0)
          expect(app_result["success"]).to be false
          expect(app_result["errors"].first).to match(/Não foi possível determinar\/criar o produto Vacina\/Fabricante/)
        end
      end

      context "when manufacturerName input with leading/trailing spaces matches an existing manufacturer" do
        let(:mutation_input_vars) do
          { input: { patientId: generate_custom_gql_id(patient_record, patient_gql_type), applications: [
            { vaccineId: generate_custom_gql_id(vaccine_regular, vaccine_gql_type), applicationDate: "2024-07-02", 
              manufacturerName: " #{mfr_real.name} ", # Name with spaces
              batchNumber: "B_SPACES_MFR" }
          ]}}
        end
        
        it "finds the manufacturer and saves the shot" do
          # This relies on find_manufacturer_by_name_or_alias doing .strip
          expect { perform_mutation(mutation_input_vars) }.to change { Shot.count }.by(1)
          result = perform_mutation(mutation_input_vars)
          payload = result.dig("data", "saveExtractedVaccineApplications", "payload")
          expect(payload["overallSuccess"]).to be true
          app_result = payload.dig("processedApplications", 0)
          expect(app_result["success"]).to be true
          expect(app_result.dig("shot", "vaccineManufacturer", "manufacturer", "name")).to eq(mfr_real.name)
        end
      end
      
      context "when a new VaccineManufacturer record needs to be created" do
        let(:mutation_input_vars) do
          { input: { patientId: generate_custom_gql_id(patient_record, patient_gql_type), applications: [
            { vaccineId: generate_custom_gql_id(vaccine_regular, vaccine_gql_type), applicationDate: "2024-07-03", 
              manufacturerName: mfr_real.name, # Valid, existing Manufacturer
              batchNumber: "B_NEW_VM" }
          ]}}
        end

        it "creates a new VaccineManufacturer and saves the shot" do
          # Ensure no VM for this combo exists beforehand
          VaccineManufacturer.where(vaccine: vaccine_regular, manufacturer: mfr_real, chain: chain).destroy_all

          expect { perform_mutation(mutation_input_vars) }.to change { VaccineManufacturer.count }.by(1)
            .and change { Shot.count }.by(1)
          
          result = perform_mutation(mutation_input_vars)
          payload = result.dig("data", "saveExtractedVaccineApplications", "payload")
          expect(payload["overallSuccess"]).to be true
          app_result = payload.dig("processedApplications", 0)
          expect(app_result["success"]).to be true
          expect(app_result.dig("shot", "vaccineManufacturer", "manufacturer", "name")).to eq(mfr_real.name)
          
          new_vm = VaccineManufacturer.find_by(vaccine: vaccine_regular, manufacturer: mfr_real, chain: chain)
          expect(new_vm).to be_present
        end
      end
    end # End context "when handling specific manufacturer name inputs"

  end # End describe "resolve"
end # bundle exec rspec spec/graphql/mutations/save_extracted_vaccine_applications_spec.rb