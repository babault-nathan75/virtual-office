name: Database Migrations

Ce dossier contient les migrations SQL pour la base de données Supabase.

## Utilisation

1. Exécuter les migrations dans l'ordre numérique
2. Copier le contenu du fichier et l'exécuter dans Supabase Dashboard > SQL Editor
3. Ou utiliser Supabase CLI: `supabase db push`

## Fichiers

- `001_all_features.sql` : Toutes les colonnes et tables nécessaires aux fonctionnalités avancées

## Rollback

En cas de problème, chaque migration peut être annulée en inversant les opérations SQL.
