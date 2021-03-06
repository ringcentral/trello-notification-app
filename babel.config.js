module.exports = (api) => {
  const isTest = api.env('test');
  if (isTest) {
    return {
      presets: [
        [
          '@babel/preset-env',
          {
            targets: {
              node: 'current',
            },
          },
        ],
      ],
    };
  }
  return {
    presets: [
      "@babel/react",
      ["@babel/env", {
        "targets": {
          "chrome": 58,
          "node": "current"
        }
      }]
    ],
    plugins: [
      "@babel/plugin-transform-runtime",
      "@babel/plugin-proposal-export-default-from",
      "@babel/plugin-proposal-function-bind",
      "@babel/plugin-proposal-optional-chaining",
      "@babel/plugin-proposal-nullish-coalescing-operator",
      ["@babel/plugin-proposal-decorators", { "legacy": true }],
      ["@babel/plugin-proposal-class-properties", { "loose": true }]
    ]
  }
};
