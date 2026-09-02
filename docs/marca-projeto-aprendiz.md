# Marca e fotografia do login

- `src/assets/projeto-aprendiz-logo.png`: logo enviada pelo usuário, com transparência preservada; 300 × 149 pixels.
- `src/assets/login-orquestra.jpg`: fotografia de orquestra enviada pelo usuário, codificada em JPEG (215.500 bytes), sem alterar o conteúdo; 2200 × 1088 pixels.
- `public/favicon-aprendiz.svg`: mesma logo sobre fundo vermelho, com tratamento branco de alto contraste e sem referências externas.
- `AuthLayout.jsx` aplica sombras em gradiente no topo e na base, logo branca e o texto de Salmos 150:6 fornecido pelo usuário. A composição aparece como painel lateral no desktop e cabeçalho no celular.
- `Sidebar.jsx` é compartilhado por gestor e professor. A logo é exibida inteira com `object-contain`, sem cortes ou texto redundante.
- O tratamento branco usa filtros CSS/SVG; a logo PNG original permanece inalterada.
- A logo do login tem largura de 128 px no celular e 144 px no desktop, com recuo superior/esquerdo de 16 e 20 px respectivamente.
- O versículo usa Allura Regular, incorporada ao projeto para não depender de serviços externos. Fonte original: Google Fonts (`https://fonts.gstatic.com/s/allura/v23/9oRPNYsQpS4zjuAPjA.ttf`). Licença SIL OFL incluída em `public/fonts/Allura-OFL.txt`.

Texto fornecido pelo usuário: “Tudo quanto tem fôlego louve ao Senhor. Louvai ao Senhor.” — Salmos 150:6.
