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
      "@babel/plugin-transform-optional-chaining",
      "@babel/plugin-transform-nullish-coalescing-operator",
      ["@babel/plugin-proposal-decorators", { "legacy": true }],
      ["@babel/plugin-transform-class-properties", { "loose": true }],
      ["@babel/plugin-transform-private-property-in-object", { "loose": true }],
      ["@babel/plugin-transform-private-methods", { "loose": true }]
    ]
  }
};
