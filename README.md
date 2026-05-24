<div align="center">

# 🎟️ Sistema de Rifa Online

**Sistema moderno e responsivo para gerenciamento de rifas online**

> Ideal para sorteios, arrecadações, ações beneficentes e chá de casa nova.

[![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)](https://developer.mozilla.org/pt-BR/docs/Web/HTML)
[![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)](https://developer.mozilla.org/pt-BR/docs/Web/CSS)
[![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)](https://developer.mozilla.org/pt-BR/docs/Web/JavaScript)
[![Firebase](https://img.shields.io/badge/Firebase-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)](https://firebase.google.com/)

[![MIT License](https://img.shields.io/badge/Licença-MIT-green?style=flat-square)](LICENSE)
[![Status](https://img.shields.io/badge/Status-Ativo-brightgreen?style=flat-square)]()

</div>

---

## 📋 Índice

- [Sobre o Projeto](#-sobre-o-projeto)
- [Funcionalidades](#-funcionalidades)
- [Tecnologias](#-tecnologias)
- [Estrutura do Projeto](#-estrutura-do-projeto)
- [Como Executar](#-como-executar)
- [Configuração Firebase](#-configuração-firebase)
- [Fluxo de Compra](#-fluxo-de-compra)
- [Painel Administrativo](#️-painel-administrativo)
- [Melhorias Futuras](#-melhorias-futuras)
- [Autor](#-autor)

---

## 💡 Sobre o Projeto

Sistema completo para criação e gerenciamento de rifas online, com interface intuitiva para compradores e painel administrativo robusto para o organizador. Desenvolvido com foco em experiência do usuário, responsividade e praticidade.

---

## ✨ Funcionalidades

| Área | Recursos |
|------|----------|
| 🎫 **Números** | Escolha manual ou seleção aleatória automática |
| 💳 **Pagamento** | Integração com PIX, cópia automática da chave |
| 📲 **WhatsApp** | Envio de comprovante diretamente pelo app |
| 🔐 **Admin** | Painel protegido por senha |
| 📊 **Estatísticas** | Arrecadação e status em tempo real |
| 🏆 **Sorteio** | Sistema automático entre números pagos |
| 🌙 **Tema** | Alternância entre modo claro e escuro |
| 📱 **Layout** | Totalmente responsivo (mobile, tablet e desktop) |

---

## 🚀 Tecnologias

- **HTML5** — Estrutura semântica
- **CSS3** — Estilização e responsividade
- **JavaScript** — Lógica e interatividade
- **Firebase Firestore** — Banco de dados em tempo real
- **Firebase Analytics** — Monitoramento de uso

---

## 📂 Estrutura do Projeto

```
📦 sistema-rifa
 ┣ 📂 img
 ┃ ┗ 📷 nos.jpeg
 ┣ 📜 index.html
 ┣ 📜 style.css
 ┣ 📜 script.js
 ┗ 📜 README.md
```

---

## ▶️ Como Executar

**1. Clone o repositório**
```bash
git clone https://github.com/seuusuario/sistema-rifa.git
```

**2. Acesse a pasta**
```bash
cd sistema-rifa
```

**3. Configure o Firebase**

Edite o arquivo `script.js` com suas credenciais (veja a seção abaixo).

**4. Execute o projeto**

Escolha uma das opções:

- [Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) (extensão do VS Code)
- [Vercel](https://vercel.com/)
- [Netlify](https://netlify.com/)
- [Firebase Hosting](https://firebase.google.com/docs/hosting)

---

## 🔥 Configuração Firebase

Crie um projeto no [Firebase Console](https://console.firebase.google.com/) e substitua as credenciais em `script.js`:

```js
const firebaseConfig = {
  apiKey: "SUA_API_KEY",
  authDomain: "SEU_DOMINIO.firebaseapp.com",
  projectId: "SEU_PROJECT_ID",
  storageBucket: "SEU_BUCKET.appspot.com",
  messagingSenderId: "SEU_ID",
  appId: "SEU_APP_ID"
};
```

> ⚠️ **Nunca suba suas credenciais reais para repositórios públicos.** Use variáveis de ambiente ou o `.gitignore` para protegê-las.

---

## 🛒 Fluxo de Compra

```
1. Usuário escolhe os números desejados
        ↓
2. Informa nome e WhatsApp
        ↓
3. Realiza o pagamento via PIX
        ↓
4. Envia o comprovante pelo WhatsApp
        ↓
5. Administrador confirma o pagamento
        ↓
6. Números são marcados como vendidos ✅
```

---

## 🛠️ Painel Administrativo

O administrador tem acesso completo para:

- ⚙️ Configurar a rifa (nome, prêmio, quantidade e valor dos números)
- 🔑 Definir chave PIX
- ✅ Aprovar ou recusar pagamentos
- 👥 Gerenciar compradores
- 🏆 Realizar o sorteio automático
- 📊 Acompanhar arrecadação em tempo real

---

## 📌 Melhorias Futuras

- [ ] Integração automática com API PIX
- [ ] Login com Firebase Authentication
- [ ] QR Code PIX gerado automaticamente
- [ ] Dashboard avançado com gráficos
- [ ] Exportação de relatórios (PDF/Excel)
- [ ] Notificações em tempo real para compradores

---

## 👨‍💻 Autor

Desenvolvido por **Lennon Reis Dos Santos**

📍 Joinville — SC, Brasil

---

<div align="center">

Se este projeto foi útil para você, considere deixar uma ⭐ no repositório!

Contribuições são bem-vindas via [Issues](../../issues) e [Pull Requests](../../pulls).

</div>
