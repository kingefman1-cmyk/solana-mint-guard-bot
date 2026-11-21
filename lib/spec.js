export const SPEC = {
  "title": "Mint Guard",
  "tagline": "Check a Solana mint before you trust it.",
  "method": "GET",
  "path": "/api/check",
  "button": "Check mint",
  "headline": [
    "safety.score",
    "safety.risk_level"
  ],
  "fields": [
    {
      "name": "mint",
      "label": "Solana mint address",
      "type": "text",
      "placeholder": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      "required": true,
      "maxlength": 44
    }
  ]
}
