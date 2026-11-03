import js from '@eslint/js';
import {defineConfig,globalIgnores} from 'eslint/config';
import tseslint from 'typescript-eslint';
import hooks from 'eslint-plugin-react-hooks';
import next from '@next/eslint-plugin-next';
import globals from 'globals';
export default defineConfig([
 globalIgnores(['.next/**','node_modules/**','.cache/**','next-env.d.ts','**/*.backup','coverage/**','playwright-report/**','test-results/**']),
 js.configs.recommended,
 {files:['**/*.{js,jsx,ts,tsx,mjs}'],languageOptions:{parser:tseslint.parser,parserOptions:{ecmaFeatures:{jsx:true}},globals:{...globals.browser,...globals.node,...globals.jest}},plugins:{'react-hooks':hooks,'@next/next':next},rules:{...next.configs.recommended.rules,'@next/next/no-img-element':'off','react-hooks/rules-of-hooks':'error','react-hooks/exhaustive-deps':'warn','no-unused-vars':'off','no-empty':['error',{allowEmptyCatch:true}]}},
 {files:['**/*.{ts,tsx}'],rules:{'no-undef':'off'}}
]);
