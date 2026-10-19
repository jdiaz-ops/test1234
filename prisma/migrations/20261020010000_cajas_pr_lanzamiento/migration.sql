-- Cajas PR: "publicar a más tardar" pasa a ser la fecha del lanzamiento
-- (Marcolini no sigue lo que publiquen las creadoras), y la marca elige si
-- también la puede proponer ("las dos": la piden y la propone).
ALTER TABLE "PrBox" RENAME COLUMN "publishBy" TO "launchOn";
ALTER TABLE "PrBox" ADD COLUMN "allowProposals" BOOLEAN NOT NULL DEFAULT true;
