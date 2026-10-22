/*
 * Configurações da Akylla Shop — gerado pelo painel (admin/).
 * Contato, PIX e textos de atendimento.
 */
window.AKYLLA_CONFIG = {
  "storeName": "Akylla Shop",
  "tagline": "Eletrônicos e Acessórios de Informática",
  "city": "Goiânia/GO",
  "whatsapp": "556281517002",
  "whatsappDisplay": "(62) 98151-7002",
  "instagram": "akylla.shop",
  "facebook": "https://www.facebook.com/profile.php?id=61574082533775",
  "whatsappMessage": "Olá! Vim pelo site da Akylla Shop e gostaria de tirar uma dúvida.",
  "pixKey": "7dda9a3c-400d-45de-906b-f22b2615f1d5",
  "pixHolder": "Joás Santana Nascimento",
  "pixMerchantName": "JOAS SANTANA NASCIMENTO",
  "pixCity": "GOIANIA",
  "deliveryNote": "Entrega combinada pelo WhatsApp em Goiânia/GO e região. Demais localidades sob consulta.",
  "warrantyNote": "Garantia legal de 90 dias para produtos duráveis, conforme o Código de Defesa do Consumidor.",
  "returnNote": "Compras online podem ser desistidas em até 7 dias corridos após o recebimento, conforme o CDC.",
  "paymentNote": "Pagamento via PIX. O pedido é confirmado após a conferência do comprovante.",
  "year": 2026,
  "promo": {
    "active": true,
    "text": "Descontos de inauguração",
    "percent": 10,
    "until": "2026-10-31"
  },
  "marginPercent": 50,
  "shipping": {
    "enabled": true,
    "pickup": true,
    "pickupNote": "Retirada combinada pelo WhatsApp no Conj. Res. Aruanã III, Goiânia/GO.",
    "originLabel": "Rua Capauam, nº 752 — Conj. Res. Aruanã III, Goiânia/GO",
    "origin": {
      "lat": -16.6818529,
      "lon": -49.2018912
    },
    "bands": [
      {
        "upToKm": 5,
        "price": 1500
      },
      {
        "upToKm": 10,
        "price": 2500,
        "promoPrice": 1500
      },
      {
        "upToKm": 15,
        "price": 3000,
        "promoPrice": 2000
      },
      {
        "upToKm": 20,
        "price": 4000,
        "promoPrice": 2500
      },
      {
        "upToKm": 30,
        "price": 5000,
        "promoPrice": 3000
      },
      {
        "upToKm": 40,
        "price": 6000,
        "promoPrice": 3500
      }
    ],
    "extraStepKm": 5,
    "extraStepPrice": 550,
    "homeCity": "Goiânia",
    "carrier": {
      "enabled": true,
      "feePercent": 30
    },
    "cities": [
      {
        "name": "Senador Canedo",
        "price": 2500
      },
      {
        "name": "Aparecida de Goiânia",
        "price": null
      },
      {
        "name": "Goianira",
        "price": null
      },
      {
        "name": "Trindade",
        "price": null
      }
    ],
    "promoUntil": "2026-10-31"
  },
  "paymentProvider": "mercadopago",
  "paymentApiUrl": "https://akylla-shop-api.akyllashop.workers.dev",
  "card": {
    "enabled": true,
    "maxInstallments": 12,
    "feePercent": 4.98
  },
  "restock": {
    "enabled": true,
    "default": 10,
    "days": 2
  }
};
