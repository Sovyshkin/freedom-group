const { defineConfig } = require('@vue/cli-service')
module.exports = defineConfig({
  transpileDependencies: true,
  publicPath: '/',
  devServer: {
    host: '0.0.0.0',
    port: 8080,
    allowedHosts: 'all',
    historyApiFallback: {
      rewrites: [
        { from: /.*/, to: '/index.html' }
      ],
      disableDotRule: true,
      verbose: true
    },
    client: {
      overlay: {
        warnings: false,
        errors: true
      }
    }
  }
})
