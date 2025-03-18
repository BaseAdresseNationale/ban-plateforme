const {setGlobalDispatcher, EnvHttpProxyAgent} = require('undici')

const envHttpProxyAgent = new EnvHttpProxyAgent()
setGlobalDispatcher(envHttpProxyAgent)
