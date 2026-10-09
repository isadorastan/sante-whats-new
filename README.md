# Agenda Personal

O front publicado fica em https://isadorastan.github.io/sante-whats-new/. O backend roda na VPS com systemd, no serviço `sante-whats`. Não usamos PM2.

- Código na VPS: `/var/www/sante-whats-new`
- API pública: https://sante-api.duckdns.org
- IP: `213.199.35.215` (`ssh root@213.199.35.215`)
- Processo: `systemctl` → `sante-whats`

O `server/.env` e as sessões do WhatsApp em `server/.baileys` (uma pasta por professor) não entram no git. Um restart não pede QR de novo e não apaga a chave do Supabase.

## Atualizar o backend

Na VPS:

```bash
cd /var/www/sante-whats-new
git pull
cd server
npm ci --omit=dev
systemctl restart sante-whats
journalctl -u sante-whats -f
```

O `npm ci` só é necessário se `server/package.json` ou `server/package-lock.json` mudou. Se a alteração foi só em código:

```bash
cd /var/www/sante-whats-new
git pull
systemctl restart sante-whats
journalctl -u sante-whats -f
```

O log tem que mostrar `WhatsApp server on` e, para cada professor já conectado, `WhatsApp conectado`. `Ctrl+C` só fecha o acompanhamento do log. O serviço continua rodando.
