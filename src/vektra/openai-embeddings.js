export class OpenAIEmbeddings {
    constructor(options) {
        this.maxTokens = options.maxTokens ?? 500;
        this.UserAgent = 'AlphaWave';
        this.options = options;

        if (options.azureApiKey) {
            this._clientType = ClientType.AzureOpenAI;
            this.options = Object.assign({
                retryPolicy: [2000, 5000],
                azureApiVersion: '2023-05-15'
            }, options);

            let endpoint = this.options.azureEndpoint.trim();
            if (endpoint.endsWith('/')) {
                endpoint = endpoint.slice(0, -1);
            }
            if (!endpoint.toLowerCase().startsWith('https://')) {
                throw new Error(`Client created with an invalid endpoint of '${endpoint}'. The endpoint must be a valid HTTPS url.`);
            }
            this.options.azureEndpoint = endpoint;
        } else if (options.ossModel) {
            this._clientType = ClientType.OSS;
            this.options = Object.assign({
                retryPolicy: [2000, 5000]
            }, options);
        } else {
            this._clientType = ClientType.OpenAI;
            this.options = Object.assign({
                retryPolicy: [2000, 5000]
            }, options);
        }
    }

    async createEmbeddings(inputs) {
        if (this.options.logRequests) {
            console.log('EMBEDDINGS REQUEST:', inputs);
        }

        const startTime = Date.now();
        const response = await this.createEmbeddingRequest({ input: inputs });

        if (this.options.logRequests) {
            console.log('RESPONSE:', {
                status: response.status,
                duration: Date.now() - startTime + 'ms',
                data: await response.json()
            });
        }

        if (response.ok) {
            const data = await response.json();
            return { status: 'success', output: data.data.sort((a, b) => a.index - b.index).map(item => item.embedding) };
        } else if (response.status === 429) {
            return { status: 'rate_limited', message: `The embeddings API returned a rate limit error.` };
        } else {
            return { status: 'error', message: `The embeddings API returned an error status of ${response.status}: ${response.statusText}` };
        }
    }

    async createEmbeddingRequest(request) {
        if (this.options.dimensions) {
            request.dimensions = this.options.dimensions;
        }

        if (this._clientType === ClientType.AzureOpenAI) {
            const options = this.options;
            const url = `${options.azureEndpoint}/openai/deployments/${options.azureDeployment}/embeddings?api-version=${options.azureApiVersion}`;
            return this.post(url, request);
        } else if (this._clientType === ClientType.OSS) {
            const options = this.options;
            const url = `${options.ossEndpoint}/v1/embeddings`;
            request.model = options.ossModel;
            return this.post(url, request);
        } else {
            const options = this.options;
            const url = `${options.endpoint ?? 'https://api.openai.com'}/v1/embeddings`;
            request.model = options.model;
            return this.post(url, request);
        }
    }

    async post(url, body, retryCount = 0) {
        const requestConfig = Object.assign({ method: 'POST', body: JSON.stringify(body) }, this.options.requestConfig);

        requestConfig.headers = requestConfig.headers || {};
        requestConfig.headers['Content-Type'] = 'application/json';
        requestConfig.headers['User-Agent'] = this.UserAgent;

        if (this._clientType === ClientType.AzureOpenAI) {
            const options = this.options;
            requestConfig.headers['api-key'] = options.azureApiKey;
        } else if (this._clientType === ClientType.OpenAI) {
            const options = this.options;
            requestConfig.headers['Authorization'] = `Bearer ${options.apiKey}`;
            if (options.organization) {
                requestConfig.headers['OpenAI-Organization'] = options.organization;
            }
        }

        const response = await fetch(url, requestConfig);

        if (response.status === 429 && Array.isArray(this.options.retryPolicy) && retryCount < this.options.retryPolicy.length) {
            const delay = this.options.retryPolicy[retryCount];
            await new Promise(resolve => setTimeout(resolve, delay));
            return this.post(url, body, retryCount + 1);
        } else {
            return response;
        }
    }
}

const ClientType = {
    OpenAI: 'OpenAI',
    AzureOpenAI: 'AzureOpenAI',
    OSS: 'OSS'
};

export default OpenAIEmbeddings;