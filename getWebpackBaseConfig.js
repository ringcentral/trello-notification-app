
module.exports = function getBaseConfig() {
  return {
    entry: {
      app: './src/client/app.js',
      ['bot-setup']: './src/client/bot-setup.js',
    },
    resolve: {
      extensions: ['.js', '.jsx'],
    },
    module: {
      rules: [
        {
          test: /\.(js|jsx)$/,
          use: [
            {
              loader: 'babel-loader',
            },
          ],
          exclude: /node_modules/,
        },
      ],
    }
  };
};
