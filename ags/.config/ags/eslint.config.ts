import config from "@echristian/eslint-config"

export default config(
  {
    ignores: ["scripts/"],
    prettier: {
      plugins: ["prettier-plugin-packagejson"],
    },
  },
  {
    rules: {
      "jsx-a11y/label-has-associated-control": "off",
      "package-json/valid-package-definition": "off",
    },
  },
)
