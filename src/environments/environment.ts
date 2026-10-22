/**
 * Configuração do ambiente.
 *
 * 1. Crie um projeto em https://console.firebase.google.com
 * 2. Em "Authentication" > "Sign-in method", habilite o provedor Google.
 * 3. Em "Configurações do projeto" > "Seus apps", registre um app Web e cole a config abaixo.
 * 4. Adicione "localhost" em "Authentication" > "Settings" > "Authorized domains".
 *
 * Enquanto `firebase.apiKey` estiver vazio, a tela de login oferece um modo convidado
 * (somente para desenvolvimento).
 *
 * `googleFontsApiKey` é opcional: com ela o catálogo de fontes lista todas as famílias do
 * Google Fonts (https://developers.google.com/fonts/docs/developer_api). Sem ela, é usado um
 * catálogo curado e o usuário ainda pode adicionar qualquer família pelo nome.
 */
export const environment = {
  firebase: {
    apiKey: '',
    authDomain: '',
    projectId: '',
    storageBucket: '',
    messagingSenderId: '',
    appId: '',
  },
  googleFontsApiKey: '',
};
