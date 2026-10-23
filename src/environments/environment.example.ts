/**
 * Modelo da configuração do ambiente. Copie para `environment.ts` (ignorado pelo Git)
 * e preencha com suas credenciais — nunca coloque chaves reais neste arquivo.
 *
 * Login com Google (Google Identity Services / OAuth 2.0):
 * 1. Em https://console.cloud.google.com/auth/clients crie (ou abra) um "ID do cliente OAuth"
 *    do tipo "Aplicativo da Web".
 * 2. Em "Origens JavaScript autorizadas", adicione http://localhost:4200 e o domínio de produção.
 * 3. Cole o ID do cliente em `googleClientId` abaixo.
 *
 * Enquanto `googleClientId` estiver vazio, a tela de login oferece só o modo visitante.
 *
 * `googleFontsApiKey` é opcional: com ela o catálogo de fontes lista todas as famílias do
 * Google Fonts (https://developers.google.com/fonts/docs/developer_api). Sem ela, é usado um
 * catálogo curado e o usuário ainda pode adicionar qualquer família pelo nome.
 */
export const environment = {
  googleClientId: '',
  googleFontsApiKey: '',
};
