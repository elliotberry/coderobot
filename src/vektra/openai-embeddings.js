export class OpenAIEmbeddings {
  constructor(options) {
    this.maxTokens = options.maxTokens ?? 4096
    this.UserAgent = "AlphaWave"
    this.options = options

    this._clientType = ClientType.OpenAI
    this.options = Object.assign(
      {
        retryPolicy: [2000, 5000]
      },
      options
    )
  }

  async createEmbeddings(inputs) {
    const startTime = Date.now()
    const response = await this.createEmbeddingRequest({ input: inputs })

    const data = await response.json()
    if (!response.ok) {
      throw new Error(`${data.error.code}: ${data.error.message}`)
    }
    return {
      status: "success",
      output: data.data
        .sort((a, b) => a.index - b.index)
        .map((item) => item.embedding)
    }
  }

  async createEmbeddingRequest(request) {
    if (this.options.dimensions) {
      request.dimensions = this.options.dimensions
    }

    const options = this.options
    const url = `${options.endpoint ?? "https://api.openai.com"}/v1/embeddings`
    request.model = options.model
    return this.post(url, request)
  }

  async post(url, body, retryCount = 0) {
    const requestConfig = Object.assign(
      { method: "POST", body: JSON.stringify(body) },
      this.options.requestConfig
    )

    requestConfig.headers = requestConfig.headers || {}
    requestConfig.headers["Content-Type"] = "application/json"
    requestConfig.headers["User-Agent"] = this.UserAgent

    if (this._clientType === ClientType.AzureOpenAI) {
      const options = this.options
      requestConfig.headers["api-key"] = options.azureApiKey
    } else if (this._clientType === ClientType.OpenAI) {
      const options = this.options
      requestConfig.headers["Authorization"] = `Bearer ${options.apiKey}`
      if (options.organization) {
        requestConfig.headers["OpenAI-Organization"] = options.organization
      }
    }

    const response = await fetch(url, requestConfig)

    if (
      response.status === 429 &&
      Array.isArray(this.options.retryPolicy) &&
      retryCount < this.options.retryPolicy.length
    ) {
      const delay = this.options.retryPolicy[retryCount]
      await new Promise((resolve) => setTimeout(resolve, delay))
      return this.post(url, body, retryCount + 1)
    } else {
      return response
    }
  }
}

const ClientType = {
  OpenAI: "OpenAI",
  AzureOpenAI: "AzureOpenAI",
  OSS: "OSS"
}

export default OpenAIEmbeddings
