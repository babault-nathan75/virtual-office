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
    /*
     * Règles du React Compiler, amenées par eslint-plugin-react-hooks 7
     * (via eslint-config-next 16.4). Elles signalent ici du code antérieur :
     * effets de chargement de données qui réinitialisent l'état (la forme
     * historique de la messagerie, des dashboards et de TrustedDevices),
     * composant `Avatar` défini dans le rendu de Navbar, et `Date.now()`
     * dans l'envoi optimiste de ChatWindow.
     *
     * Corriger ces sites sans test navigateur sur la messagerie ferait plus
     * de mal que de bien — le découpage de ChatWindow et Navbar est à l'ordre
     * du jour (ARCHITECTURE §5). On garde donc les violations visibles en
     * « warn » (la CI ne casse pas) plutôt que de les taire.
     */
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/static-components": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/refs": "warn",
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
