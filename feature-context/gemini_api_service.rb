# File Path: app/services/gemini_api_service.rb

require 'net/http'
require 'uri'
require 'json'
require 'base64'
# fuzzy_match is no longer directly used by this service if Gemini handles closest match.
# You can remove it from here and Gemfile if not used elsewhere.
# require 'fuzzy_match'

class GeminiApiService
  ServiceResponse = Struct.new(:success?, :data, :errors) do
    def self.success(data)
      new(true, data, nil)
    end

    def self.failure(errors)
      new(false, nil, Array(errors).map(&:to_s))
    end
  end

  GEMINI_MODEL_IDENTIFIER = "gemini-2.5-flash" # Your confirmed model
  GEMINI_API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models"
  MAX_REQUEST_SIZE_BYTES = 20 * 1024 * 1024

  # Keys Gemini extracts from the IMAGE
  IMAGE_EXTRACTED_KEYS = [
    "vaccine_name", "application_date", "manufacturer", "batch_number",
    "expiry_date", "application_location", "application_registry",
    "applicator_name"
  ].freeze

  # Keys Gemini DERIVES based on CONTEXT
  CONTEXT_DERIVED_KEYS = [
    "is_existing_record", "closest_known_active_vaccine", "suggested_dose"
  ].freeze

  DEFAULT_VALUE_FOR_MISSING_FIELD = "(Não especificado)".freeze
  UNCERTAIN_FIELD_MARKER = " (?)".freeze

  VACCINATION_CARD_DATA_SCHEMA = {
    type: "OBJECT",
    properties: {
      vaccine_applications: {
        type: "ARRAY",
        description: "Uma lista de todas as aplicações de vacinas identificadas na carteirinha, incluindo informações de correlação.",
        items: {
          type: "OBJECT",
          description: "Detalhes de uma única aplicação de vacina, incluindo informações derivadas do contexto fornecido.",
          properties: {
            vaccine_name: { type: "STRING", description: "Nome da Vacina. Capture da imagem o nome mais completo e descritivo. Mantenha a capitalização original." },
            application_date: { type: "STRING", description: "Data de Aplicação (DD/MM/AAAA) conforme a imagem. Se ilegível/incerta, anexe '#{UNCERTAIN_FIELD_MARKER}' à data." },
            manufacturer: { type: "STRING", description: "Fabricante conforme a imagem. Infira se possível. Se ausente na imagem, use '#{DEFAULT_VALUE_FOR_MISSING_FIELD}'." },
            batch_number: { type: "STRING", description: "Lote conforme a imagem. Se ausente na imagem, use '#{DEFAULT_VALUE_FOR_MISSING_FIELD}'." },
            expiry_date: { type: "STRING", description: "Data de Validade do lote (DD/MM/AAAA) conforme a imagem. Se ausente na imagem, use '#{DEFAULT_VALUE_FOR_MISSING_FIELD}'." },
            application_location: { type: "STRING", description: "Local de Aplicação conforme a imagem. Se ausente na imagem, use '#{DEFAULT_VALUE_FOR_MISSING_FIELD}'." },
            application_registry: { type: "STRING", description: "Registro da Aplicação conforme a imagem. Se ausente na imagem, use '#{DEFAULT_VALUE_FOR_MISSING_FIELD}'." },
            applicator_name: { type: "STRING", description: "Nome do profissional que aplicou a vacina, conforme a imagem. Se ausente na imagem, use '#{DEFAULT_VALUE_FOR_MISSING_FIELD}'." },
            is_existing_record: {
              type: "BOOLEAN",
              description: "Avalie se esta aplicação de vacina (baseada no `vaccine_name` e `application_date` extraídos da imagem) corresponde a um dos 'Registros de vacinas existentes para este paciente' fornecidos no contexto do prompt. Defina como `true` se houver uma correspondência razoável (considere pequenas variações no nome da vacina e garanta que as datas sejam as mesmas). Caso contrário, ou se não houver registros de contexto, defina como `false`."
            },
            closest_known_active_vaccine: {
              type: "STRING",
              description: "Do `vaccine_name` extraído da imagem, encontre o nome MAIS SIMILAR da lista 'Vacinas ativas conhecidas' (fornecida no contexto do prompt). Retorne o nome EXATO da lista de 'Vacinas ativas conhecidas'. Se não houver uma correspondência próxima, se a lista de vacinas ativas não for fornecida, ou se o `vaccine_name` extraído for '#{DEFAULT_VALUE_FOR_MISSING_FIELD}', retorne '#{DEFAULT_VALUE_FOR_MISSING_FIELD}'."
            },
            suggested_dose: {
              type: "STRING",
              description: "Baseado no `closest_known_active_vaccine` e no conteúdo da imagem, sugira a dose mais provável da lista de 'Doses Possíveis por Vacina' fornecida no contexto. Por exemplo, se a imagem diz 'D1' ou '1a', e as doses possíveis para a vacina sugerida são ['1ª Dose', '2ª Dose'], retorne '1ª Dose'. Retorne a string exata da dose da lista. Se nenhuma dose for provável, retorne '#{DEFAULT_VALUE_FOR_MISSING_FIELD}'."
            }
          },
          required: ["vaccine_name", "application_date"] # Core fields from image
        }
      }
    },
    required: ["vaccine_applications"]
  }.freeze

  VACCINATION_CARD_PROMPT = <<~PROMPT.strip
    **Objetivo:** Analisar a imagem de uma carteira de vacinação e extrair informações detalhadas sobre CADA APLICAÇÃO INDIVIDUAL de vacina registrada. Além disso, você deve correlacionar os dados extraídos com informações de contexto que serão fornecidas.

    **Instruções Detalhadas para Extração e Derivação:**

    1.  **Identifique Entradas Individuais da Imagem:** Para cada aplicação de vacina visível na imagem, colete os dados associados. Preste atenção para não duplicar entradas se a mesma vacina aparecer múltiplas vezes com as mesmas informações.

    2.  **Dados a Extrair da IMAGEM para CADA Aplicação (conforme o schema JSON):**
        - **`vaccine_name` (Nome da Vacina):** Nome completo e descritivo da vacina aplicada, conforme visível na imagem. **IMPORTANTE: Se o nome da vacina e o nome do fabricante aparecerem juntos na imagem (ex: "Hexavalente GSK" ou "Prevenar 13 Pfizer"), coloque APENAS o nome da vacina neste campo (ex: "Hexavalente" ou "Prevenar 13"). O nome do fabricante deve ir para o campo `manufacturer`.** Mantenha a capitalização original do nome da vacina.
        - **`application_date` (Data de Aplicação):** Data em que a vacina foi aplicada, conforme visível na imagem. Formato DD/MM/AAAA.
        - **`manufacturer` (Fabricante):** Nome do laboratório/fabricante da vacina, conforme visível na imagem. **Se você extraiu o fabricante junto com o nome da vacina no passo anterior, coloque o nome do fabricante aqui.** Se não estiver visível, infira se possível com base no nome da vacina (ex: "Prevenar 13" é geralmente "Pfizer" ou "Wyeth"). Mantenha a capitalização original.
        - **`batch_number` (Lote):** Número do lote da vacina, conforme visível na imagem.
        - **`expiry_date` (Data de Validade):** Data de validade do lote da vacina (DD/MM/AAAA), conforme visível na imagem.
        - **`application_location` (Local de Aplicação):** Nome da clínica ou local onde a vacina foi administrada, conforme visível na imagem.
        - **`application_registry` (Registro da Aplicação):** Número de registro ou identificador da aplicação, se houver, conforme visível na imagem.
        - **`applicator_name` (Nome do Aplicador):** Nome do profissional de saúde que administrou a vacina, conforme visível na imagem.

    3.  **Dados DERIVADOS (a serem preenchidos por você, Gemini, usando o CONTEXTO FORNECIDO abaixo):**
        Para cada aplicação de vacina que você extraiu da imagem no passo 2:
        - **`is_existing_record` (BOOLEAN):** Compare o `vaccine_name` e `application_date` (ambos extraídos da imagem no passo 2) com cada entrada na lista de "Registros de vacinas existentes para este paciente" (fornecida no contexto abaixo). Para que seja considerado uma correspondência (`true`):
            - O `vaccine_name` extraído da imagem deve ser muito similar ou idêntico a um `vaccine_name` nos registros existentes. Considere variações comuns, como abreviações (ex: "DTPA" vs "DTPa Acelular"), inclusão/omissão do fabricante no nome (ex: "Shingrix GSK" vs "Shingrix"), ou pequenas diferenças de escrita. O significado principal da vacina deve ser o mesmo.
            - A `application_date` extraída da imagem deve ser EXATAMENTE idêntica à `application_date` no registro existente (após ambas serem normalizadas para o formato DD/MM/AAAA).
            Se uma correspondência clara de nome E data for encontrada, defina este campo como `true`. Caso contrário, ou se a lista de "Registros de vacinas existentes" não for fornecida, defina como `false`.
        - **`closest_known_active_vaccine` (STRING):** Pegue o `vaccine_name` que você extraiu da imagem. Compare-o com cada nome na lista de "Vacinas ativas conhecidas" (fornecida no contexto abaixo). Retorne o nome EXATO da lista de "Vacinas ativas conhecidas" que for textualmente mais similar. O objetivo é encontrar a melhor correspondência possível.
            - Exemplo: Se o nome extraído da imagem for "Pneumo 13v" e a lista de ativas contiver "Pneumo 15 - VAXNEUVANCE®" e "Pneumo 10", e "Pneumo 10" for o mais similar, retorne "Pneumo 10".
            - Exemplo: Se o nome extraído for "Vacina Gripe Comum" e a lista tiver "FLUARIX tetra gripe", retorne "FLUARIX tetra gripe" se for a correspondência mais próxima e razoável.
            Se nenhuma vacina na lista de "Vacinas ativas conhecidas" for suficientemente similar (ou seja, se o nome extraído for muito diferente de todos os nomes na lista), ou se a lista não for fornecida, ou se o `vaccine_name` extraído da imagem for nulo ou '#{DEFAULT_VALUE_FOR_MISSING_FIELD}', então retorne o valor literal '#{DEFAULT_VALUE_FOR_MISSING_FIELD}'.
        - **`suggested_dose` (STRING):** Olhe para a vacina que você identificou em `closest_known_active_vaccine`. Agora, encontre a lista de doses para essa vacina no contexto "Doses Possíveis por Vacina". Compare essa lista com qualquer informação de dose na imagem (ex: "D1", "R", "2ª dose", anotações de reforço). Escolha e retorne a string EXATA da dose da lista que for a mais provável. Se nenhuma for provável ou a vacina não estiver na lista de doses, retorne '#{DEFAULT_VALUE_FOR_MISSING_FIELD}'.
    4.  **Política para Dados Ausentes/Ilegíveis nos campos extraídos da IMAGEM (APLIQUE A TODOS OS CAMPOS DO PASSO 2):**
        - **Ausente na Imagem:** Se uma informação para os campos `manufacturer`, `batch_number`, `expiry_date`, `application_location`, `application_registry`, ou `applicator_name` estiver completamente ausente na imagem, inclua o campo no JSON com o valor `#{DEFAULT_VALUE_FOR_MISSING_FIELD}`. Os campos `vaccine_name` e `application_date` devem sempre ser extraídos da imagem.
        - **Datas Ilegíveis/Incertas da Imagem (`application_date`, `expiry_date`):** Se qualquer parte da data estiver ilegível ou incerta na imagem, use o formato DD/MM/AAAA para a parte legível e anexe o marcador `#{UNCERTAIN_FIELD_MARKER}` ao final da string da data (ex: `DD/MM/????#{UNCERTAIN_FIELD_MARKER}` ou `??/MM/YYYY#{UNCERTAIN_FIELD_MARKER}`). Se completamente ilegível mas uma data é esperada, use `#{DEFAULT_VALUE_FOR_MISSING_FIELD}#{UNCERTAIN_FIELD_MARKER}`. Se legível, NÃO adicione o marcador.
        - **Outros Campos Ilegíveis da Imagem (`manufacturer`, `batch_number`, etc.):** Se parcialmente ilegível na imagem, transcreva a parte legível e anexe `#{UNCERTAIN_FIELD_MARKER}`. Se totalmente ilegível (mas o campo está presente na carteirinha), use `#{DEFAULT_VALUE_FOR_MISSING_FIELD}#{UNCERTAIN_FIELD_MARKER}`. Se o campo estiver completamente ausente na imagem, use `#{DEFAULT_VALUE_FOR_MISSING_FIELD}`.

    5.  **Output:** Forneça os dados extraídos ESTRITAMENTE conforme o schema JSON definido, incluindo TODOS os campos (os extraídos da imagem E os derivados por você a partir do contexto) para cada aplicação. Certifique-se de que o JSON seja válido.

    --- INÍCIO DAS INFORMAÇÕES DE CONTEXTO (UTILIZE PARA PREENCHER OS CAMPOS DERIVADOS) ---
    {CONTEXT_PLACEHOLDER}
    --- FIM DAS INFORMAÇÕES DE CONTEXTO ---
  PROMPT

  def initialize
    @api_key = ENV['GOOGLE_GEMINI_API_KEY']
    unless @api_key.present?
      Rails.logger.error "[GeminiApiServiceInitialize] CRITICAL: GOOGLE_GEMINI_API_KEY not found in environment variables. Service will be non-functional."
    end
  end

  def process_file(image_base64_data:, original_filename:, content_type:, known_active_vaccines: [], existing_shot_records: [], possible_doses_by_vaccine: {})
    unless @api_key.present?
      Rails.logger.error "[GeminiApiServiceProcessFile] Attempted to process file but API key is missing."
      return ServiceResponse.failure("Gemini API key not configured. Please check server environment.")
    end

    if image_base64_data.blank?
      Rails.logger.warn "[GeminiApiServiceProcessFile] image_base64_data is blank for file: #{original_filename}"
      return ServiceResponse.failure("Image data is empty and cannot be processed.")
    end

    supported_image_types = ['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif']
    unless supported_image_types.include?(content_type.downcase.strip)
      Rails.logger.warn "[GeminiApiServiceProcessFile] Unsupported file content type: '#{content_type}' for file: #{original_filename}. Supported: #{supported_image_types.join(', ')}"
      return ServiceResponse.failure("Unsupported file type: '#{content_type}'. Please provide a supported image (PNG, JPEG, WEBP, HEIC, HEIF).")
    end

    begin
      # --- Construct the prompt with additional context ---
      context_block_string = ""
      context_parts = []

      if known_active_vaccines.is_a?(Array) && known_active_vaccines.any?
        vaccine_list_string = known_active_vaccines.map { |name| "- #{name}" }.join("\n")
        context_parts << <<~CONTEXT_PROMPT
        **Vacinas ativas conhecidas (geralmente da rede/clínica):**
        #{vaccine_list_string}
        CONTEXT_PROMPT
      else
        context_parts << "**Vacinas ativas conhecidas (geralmente da rede/clínica):** Nenhuma informação fornecida."
      end

      # <<<< NEW: Add dose context to the prompt
      if possible_doses_by_vaccine.is_a?(Hash) && possible_doses_by_vaccine.any?
        dose_list_string = possible_doses_by_vaccine.map do |vaccine_name, doses|
          "- #{vaccine_name}: [#{doses.join(', ')}]"
        end.join("\n")
        context_parts << <<~DOSE_CONTEXT_PROMPT
        **Doses Possíveis por Vacina:**
        #{dose_list_string}
        DOSE_CONTEXT_PROMPT
      else
        context_parts << "**Doses Possíveis por Vacina:** Nenhuma informação fornecida."
      end
      # <<<< END NEW: Add dose context to the prompt

      if existing_shot_records.is_a?(Array) && existing_shot_records.any?
        shots_summary = existing_shot_records.map do |shot|
          name = shot[:vaccine_name] || DEFAULT_VALUE_FOR_MISSING_FIELD
          date = shot[:application_date] || DEFAULT_VALUE_FOR_MISSING_FIELD
          manu = shot[:manufacturer] || DEFAULT_VALUE_FOR_MISSING_FIELD
          batch = shot[:batch] || DEFAULT_VALUE_FOR_MISSING_FIELD
          dose = shot[:dose] || DEFAULT_VALUE_FOR_MISSING_FIELD
          "- Vacina: #{name}, Data: #{date}, Lote: #{batch}, Fabricante: #{manu}, Dose: #{dose}"
        end.join("\n")
        context_parts << <<~SHOT_CONTEXT_PROMPT
        **Registros de vacinas existentes para este paciente:**
        #{shots_summary}
        SHOT_CONTEXT_PROMPT
      else
        context_parts << "**Registros de vacinas existentes para este paciente:** Nenhum registro prévio fornecido."
      end
      
      context_block_string = context_parts.join("\n\n")
      current_prompt = VACCINATION_CARD_PROMPT.sub("{CONTEXT_PLACEHOLDER}", context_block_string)
      
      Rails.logger.info "[GeminiApiServiceProcessFile] Prompt constructed with contextual information for Gemini."
      Rails.logger.debug "[GeminiApiServiceProcessFile] Full prompt for Gemini: #{current_prompt}" # For debugging

      # --- Prepare the request body (using your tested and confirmed approach) ---
      request_body_hash = {
        contents: [{
          parts: [
            { text: current_prompt },
            { inline_data: {
                mime_type: content_type,
                data: image_base64_data
              }
            }
          ]
        }],
        generation_config: {
          temperature: 0.2, # Lowered for more deterministic JSON based on schema
          response_mime_type: "application/json",
          response_schema: VACCINATION_CARD_DATA_SCHEMA
        }
      }

      request_body_json_string = request_body_hash.to_json
      total_request_size_bytes = request_body_json_string.bytesize

      Rails.logger.info "[GeminiApiServiceProcessFile] Original filename: #{original_filename}. Total request JSON size: #{total_request_size_bytes} bytes."

      if total_request_size_bytes > MAX_REQUEST_SIZE_BYTES
        error_message = "The file data for '#{original_filename}' is too large to process. Total request size (#{format('%.2f', total_request_size_bytes / (1024.0*1024.0))} MB) exceeds the #{MAX_REQUEST_SIZE_BYTES / (1024.0*1024.0)} MB limit."
        Rails.logger.error "[GeminiApiServiceProcessFile] #{error_message}"
        return ServiceResponse.failure(error_message)
      end

      Rails.logger.info "[GeminiApiServiceProcessFile] Processing '#{original_filename}' with Gemini model '#{GEMINI_MODEL_IDENTIFIER}'."

      # --- Net::HTTP Call (Your tested and working logic) ---
      uri_string = "#{GEMINI_API_BASE_URL}/#{GEMINI_MODEL_IDENTIFIER}:generateContent?key=#{@api_key}"
      uri = URI.parse(uri_string)
      http = Net::HTTP.new(uri.host, uri.port)
      http.use_ssl = true
      http.read_timeout = 120
      http.open_timeout = 30

      request = Net::HTTP::Post.new(uri.request_uri)
      request['Content-Type'] = 'application/json'
      request.body = request_body_json_string

      response = http.request(request)
      Rails.logger.info "[GeminiApiServiceProcessFile] Received HTTP status: #{response.code} for file: #{original_filename}"

      unless response.is_a?(Net::HTTPSuccess)
        error_message = "Gemini API HTTP Error: #{response.code} #{response.message}"
        response_body_for_error = response.body.to_s.truncate(500)
        begin
          error_details = JSON.parse(response.body)
          error_message += " - Details: #{error_details.dig('error', 'message') || response_body_for_error}"
        rescue JSON::ParserError
          error_message += " - Body: #{response_body_for_error}"
        end
        Rails.logger.error "[GeminiApiServiceProcessFile] #{error_message} for file: #{original_filename}. Full Response Body (truncated): #{response.body.to_s.truncate(2000)}"
        return ServiceResponse.failure("Gemini API request failed with status #{response.code}.")
      end

      response_data = JSON.parse(response.body)
      Rails.logger.debug "[GeminiApiServiceProcessFile] Full Gemini Response Data: #{response_data.to_json}"

      candidates = response_data.dig("candidates")
      unless candidates.is_a?(Array) && candidates.first.is_a?(Hash)
        Rails.logger.error "[GeminiApiServiceProcessFile] No valid candidates array in Gemini response for file: #{original_filename}. Response: #{response.body.to_s.truncate(500)}"
        return ServiceResponse.failure("Gemini API did not return any valid candidates.")
      end
      
      first_candidate = candidates.first
      content_parts = first_candidate.dig("content", "parts")
      unless content_parts.is_a?(Array) && content_parts.first.is_a?(Hash)
        Rails.logger.error "[GeminiApiServiceProcessFile] No valid content parts in Gemini candidate for file: #{original_filename}. Candidate: #{first_candidate.to_json.truncate(500)}"
        return ServiceResponse.failure("Gemini API response malformed (no content/parts).")
      end

      part_data = content_parts.first
      parsed_llm_output = nil # Will hold the Hash from Gemini's JSON string

      # This parsing logic is based on your service being "tested and working"
      # with a model that returns JSON directly in the "text" field when response_schema is used.
      if part_data.key?("text") && part_data["text"].is_a?(String)
        json_string_from_text = part_data["text"]
        Rails.logger.info "[GeminiApiServiceProcessFile] Received JSON as a string within a text part for file: #{original_filename}. Length: #{json_string_from_text.length}"
        cleaned_json_string = json_string_from_text.strip.gsub(/^```json\s*|\s*```$/, '').strip # Remove markdown fences
        if cleaned_json_string.blank?
            Rails.logger.error "[GeminiApiServiceProcessFile] Empty JSON string after cleaning for file: #{original_filename}. Original text: #{json_string_from_text}"
            return ServiceResponse.failure("Gemini returned an empty JSON string.")
        end
        parsed_llm_output = JSON.parse(cleaned_json_string)
      else
        Rails.logger.error "[GeminiApiServiceProcessFile] Unexpected structure in Gemini response part for file: #{original_filename}. Expected 'text' key. Got: #{part_data.inspect}. Full response: #{response.body.to_s.truncate(1000)}"
        return ServiceResponse.failure("Gemini API did not return data in the expected format (no text part).")
      end
      # --- End API Call and Initial Parsing ---


      # --- Post-processing: Ensure all schema fields (including derived ones) are present ---
      if parsed_llm_output.is_a?(Hash) && parsed_llm_output["vaccine_applications"].is_a?(Array)
        Rails.logger.info "[GeminiApiServicePostProcessing] Verifying schema adherence for #{parsed_llm_output["vaccine_applications"].count} applications from Gemini."
        
        # All keys we expect in each application object, including those Gemini should derive
        all_expected_keys_in_schema_item = VACCINATION_CARD_DATA_SCHEMA.dig(:properties, :vaccine_applications, :items, :properties).keys.map(&:to_s)

        final_applications = parsed_llm_output["vaccine_applications"].map do |gemini_app|
          unless gemini_app.is_a?(Hash)
            Rails.logger.warn "[GeminiApiServicePostProcessing] Skipping non-hash item from Gemini's vaccine_applications: #{gemini_app.inspect}"
            next nil
          end

          # Ensure all keys defined in our VACCINATION_CARD_DATA_SCHEMA (items.properties) are present
          # This includes both image-extracted and context-derived keys that Gemini was asked to fill.
          processed_app_data = {}
          all_expected_keys_in_schema_item.each do |key_string|
            if gemini_app.key?(key_string) && 
               (gemini_app[key_string].is_a?(String) ? !gemini_app[key_string].strip.empty? : !gemini_app[key_string].nil?)
              processed_app_data[key_string] = gemini_app[key_string]
            else
              # Defaulting logic for any field Gemini might have missed
              default_val = case key_string
                            when "is_existing_record" then false # Boolean default
                            else DEFAULT_VALUE_FOR_MISSING_FIELD
                            end
              Rails.logger.warn "[GeminiApiServicePostProcessing] Key '#{key_string}' was missing or blank from Gemini's output for an application. Defaulting to '#{default_val}'."
              processed_app_data[key_string] = default_val
            end
          end
          processed_app_data
        end.compact # Remove any nil items if skipping non-hash items

        final_data = { "vaccine_applications" => final_applications }
        Rails.logger.info "[GeminiApiServicePostProcessing] Schema adherence check and defaulting complete."
        ServiceResponse.success(final_data)
      else
        Rails.logger.error "[GeminiApiServicePostProcessing] Parsed LLM output structure issue: 'vaccine_applications' not an array or main output not a hash. Output: #{parsed_llm_output.to_json.truncate(500)}"
        ServiceResponse.failure("LLM output structure was invalid after parsing (expected vaccine_applications array).")
      end

    rescue JSON::ParserError => e
      current_parsed_string = defined?(cleaned_json_string) ? cleaned_json_string : (defined?(json_string_from_text) ? json_string_from_text : response&.body)
      Rails.logger.error "[GeminiApiServiceProcessFile] JSON::ParserError: #{e.message}. Last string attempted to parse (if available): #{current_parsed_string.to_s.truncate(1000)}"
      ServiceResponse.failure("Error parsing data from Gemini.")
    rescue Net::OpenTimeout, Net::ReadTimeout, SocketError => e
      Rails.logger.error "[GeminiApiServiceProcessFile] Network error: #{e.message}"
      ServiceResponse.failure("Network error while communicating with Gemini.")
    rescue StandardError => e
      Rails.logger.error "[GeminiApiServiceProcessFile] Unexpected error: #{e.message}\n#{e.backtrace.first(10).join("\n")}"
      ServiceResponse.failure("An unexpected error occurred during Gemini processing.")
    end
  end
end