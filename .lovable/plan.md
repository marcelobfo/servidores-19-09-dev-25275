

# Plano: Adicionar QR Code visual no modal de pagamento PIX

## Contexto
O `PaymentModal` ja recebe `pix_qr_code` (imagem base64 do QR Code) do backend, mas so exibe o codigo Copia e Cola. Basta renderizar a imagem.

## Alteracao

**`src/components/payment/PaymentModal.tsx`**:
- Adicionar um botao "Mostrar QR Code" abaixo do bloco PIX Copia e Cola
- Ao clicar, exibe/oculta a imagem base64 do QR Code (`paymentData.pix_qr_code`) usando `<img src="data:image/png;base64,...">`
- Usar estado `showQrCode` para toggle
- Adicionar icone `QrCode` do lucide-react

