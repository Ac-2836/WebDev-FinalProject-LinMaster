-- Baseline migration (P1-03): starts the migration history before any table exists.
-- Tables arrive module by module in later migrations (User in P1-05, vocab + flashcard in P2-01, exam in P3-02).
SELECT 1;
