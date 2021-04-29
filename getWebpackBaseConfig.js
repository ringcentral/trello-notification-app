
module.exports = function getBaseConfig() {
  return {
    entry: {
      app: './src/assets/app.js',
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
