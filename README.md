# Kauã Mattos — portfólio

Site pessoal estático (HTML + CSS + JS puro), sem build. Funciona direto no GitHub Pages ou no Firebase Hosting.

## Estrutura

```
index.html        estrutura das seções
css/style.css     visual, temas claro/escuro, responsivo
js/i18n.js        TODO o texto do site em PT / ES / EN / JA
js/config.js      e-mail, WhatsApp e links sociais
js/main.js        animações, troca de idioma, chat → e-mail
assets/           foto, favicon e imagem de compartilhamento (og.png)
```

## Atualizar conteúdo

- **Textos e traduções:** edite `js/i18n.js`. Cada chave existe nos 4 idiomas — mude nos quatro.
- **Nova experiência:** copie um `<li class="job">` em `index.html`, troque o prefixo das chaves
  (ex.: `eazzy.role`) e adicione as chaves novas em `js/i18n.js`.
- **Novo projeto:** copie um `<article class="pcard">` em `index.html` e adicione a descrição (`pN.desc`) em `js/i18n.js`.
- **Foto:** substitua `assets/kaua.jpg` (quadrada, ~500px).

## Chat por e-mail (FormSubmit)

O chat envia as mensagens para `kauasilvamattos0000@gmail.com` pelo [FormSubmit](https://formsubmit.co), sem servidor.

1. Publique o site.
2. Mande uma mensagem de teste pelo próprio chat.
3. Abra o e-mail do FormSubmit e clique em **Activate Form**. A partir daí todas as mensagens chegam.
4. (Opcional) O FormSubmit te manda um código aleatório; troque o e-mail na URL de `formEndpoint`
   em `js/config.js` por esse código para não expor o endereço no código.

Se o envio falhar, o chat oferece links diretos para e-mail e WhatsApp.

## Rodar localmente

```bash
python -m http.server 5173
```

Abra http://127.0.0.1:5173

## Publicar no GitHub Pages

1. Crie um repositório público chamado **`Kawatos.github.io`** (o site fica em https://kawatos.github.io).
2. Envie estes arquivos:

```bash
git remote add origin https://github.com/Kawatos/Kawatos.github.io.git
git push -u origin main
```

3. No GitHub: **Settings → Pages → Source: Deploy from a branch → `main` / `(root)`**.

## Publicar no Firebase (alternativa)

```bash
npm i -g firebase-tools
firebase login
firebase init hosting   # public directory: .  | single-page app: No
firebase deploy
```
