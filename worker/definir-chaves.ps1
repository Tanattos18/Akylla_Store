# Cadastra as chaves do servidor como SEGREDOS (criptografados) na Cloudflare.
# Uso (PowerShell, dentro da pasta worker):  & .\definir-chaves.ps1
# Cole cada chave quando for pedida (ela não aparece na tela) e aperte Enter.
# Para pular uma chave que você ainda não tem, aperte Ctrl+C só naquele passo e rode de novo depois.
# Nada é salvo em arquivo nem enviado para o GitHub.

Set-Location -Path $PSScriptRoot

$todas = @(
  @{ Nome = 'GITHUB_TOKEN';      Dica = 'OBRIGATORIA - GitHub, chave "Servidor Akylla" (comeca com github_pat_). Reserva e devolve o estoque.' },
  @{ Nome = 'CALLMEBOT_APIKEY';  Dica = 'OPCIONAL - CallMeBot apikey (alerta extra no WhatsApp). Se nao tiver, aperte Ctrl+C.' },
  @{ Nome = 'MP_ACCESS_TOKEN';   Dica = 'MERCADO PAGO - Access Token de PRODUCAO (comeca com APP_USR-).' },
  @{ Nome = 'MP_WEBHOOK_SECRET'; Dica = 'MERCADO PAGO - Assinatura secreta do Webhook (aplicacao > Webhooks).' }
)

# Para cadastrar so algumas:  & .\definir-chaves.ps1 MP_ACCESS_TOKEN MP_WEBHOOK_SECRET
# (guarda os nomes antes: dentro do Where-Object, $args seria outra variável)
$pedidas = @($args)
if ($pedidas.Count -gt 0) {
  $chaves = @($todas | Where-Object { $pedidas -contains $_.Nome })
  if ($chaves.Count -eq 0) { Write-Host ('Nenhuma chave conhecida em: ' + ($pedidas -join ', ')) -ForegroundColor Red; exit 1 }
}
else { $chaves = @($todas | Select-Object -First 2) }

$i = 1
foreach ($c in $chaves) {
  Write-Host ''
  Write-Host ("{0}/{1}  {2}" -f $i, $chaves.Count, $c.Dica) -ForegroundColor Cyan
  Write-Host '      Cole a chave e aperte Enter:' -ForegroundColor Yellow
  npx --yes wrangler@3 secret put $c.Nome
  $i++
}

Write-Host ''
Write-Host 'Conferindo o servidor...' -ForegroundColor Cyan
Invoke-RestMethod 'https://akylla-shop-api.akyllashop.workers.dev/api/health' | ConvertTo-Json
Write-Host 'Confira: "configured": true (GitHub) e "mercadopago": true (Mercado Pago). Depois volte ao chat e diga "pronto".' -ForegroundColor Green
