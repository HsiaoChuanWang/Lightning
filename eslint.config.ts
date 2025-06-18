// To allow more languages other than `ts` in `.vue` files, uncomment the following lines:
// import { configureVueProject } from '@vue/eslint-config-typescript'
// configureVueProject({ scriptLangs: ['ts', 'tsx'] })
// More info at https://github.com/vuejs/eslint-config-typescript/#advanced-setup

// export default defineConfigWithVueTs(
//   {
//     name: 'app/files-to-lint',
//     files: ['**/*.{ts,mts,tsx,vue}'],
//   },

//   globalIgnores(['**/dist/**', '**/dist-ssr/**', '**/coverage/**']),

//   pluginVue.configs['flat/essential'],
//   vueTsConfigs.recommended,
//   skipFormatting,
// )

module.exports = {
  root: true,
  env: {
    node: true,
  },
  extends: ['plugin:vue/vue3-essential', '@vue/typescript/recommended', '@vue/prettier'],
  ignorePatterns: ['dist/', 'dist-ssr/', 'coverage/'],
  rules: {},
}
