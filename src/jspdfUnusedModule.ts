// Remplace html2canvas, DOMPurify et canvg, que jsPDF ne charge que pour
// convertir du HTML ou du SVG en PDF. L'application dessine ses PDF
// directement et n'appelle jamais ces conversions : les livrer ajoutait
// environ 100 Kio compressés qu'aucun appareil ne téléchargeait. Si l'une
// d'elles devenait nécessaire, jsPDF transmettrait cette erreur.
throw new Error("Module optionnel de jsPDF non livré avec l'application.");
