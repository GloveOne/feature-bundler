module Graph
  module Types
    class ProcessBase64FileInputType < GraphQL::Schema::InputObject
      graphql_name "ProcessBase64FileInput" # Explicit name
      description "Attributes for processing a Base64 encoded file with Gemini"

      argument :file_content_base64, String, required: true,
                description: "The Base64 encoded content of the file."
      argument :original_filename, String, required: true,
                description: "The original filename (e.g., 'image.png')."
      argument :content_type, String, required: true,
                description: "The MIME type of the file (e.g., 'image/png')."
      argument :patient_id, ID, required: true, # Or String, depending on how you handle IDs
                description: "The ID of the patient associated with this vaccination card."
    end
  end
end