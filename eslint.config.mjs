import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // `const { champ, ...reste } = objet` est la façon idiomatique d'omettre
      // une clé ; sans ignoreRestSiblings la variable extraite est signalée
      // comme inutilisée alors que c'est précisément son rôle.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          ignoreRestSiblings: true,
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],

      // Aucun rechargement complet de page dans une application à navigation
      // client. Ces appels rejouent tout le JavaScript, effacent l'état en
      // mémoire et donnent l'écran blanc que l'on cherche justement à éviter.
      // Les remplacements : `router.refresh()` pour redemander les données au
      // serveur, `router.push`/`replace` pour naviguer, et un rappel de la
      // fonction de chargement pour un bouton « Réessayer ».
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "CallExpression[callee.property.name='reload'][callee.object.property.name='location']",
          message:
            "Pas de window.location.reload() : utilisez router.refresh(), ou relancez la fonction de chargement concernée.",
        },
        {
          selector: "CallExpression[callee.object.name='location'][callee.property.name='reload']",
          message:
            "Pas de location.reload() : utilisez router.refresh(), ou relancez la fonction de chargement concernée.",
        },
        {
          selector:
            "AssignmentExpression[left.property.name='href'][left.object.property.name='location']",
          message:
            "Pas d'affectation de window.location.href : utilisez router.push() ou router.replace().",
        },
      ],
    },
  },
  {
    // Le service worker et les scripts hors application ne disposent pas du
    // routeur Next : la règle ne s'y applique pas.
    files: ["public/**", "scripts/**"],
    rules: { "no-restricted-syntax": "off" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
