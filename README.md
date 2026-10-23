# Estante — leitor de livros digitais

Angular 22 + Angular Material 3 + TypeScript, organizado em **arquitetura limpa**.
Leia **EPUB, PDF e MOBI** no navegador, organize-os em estantes e personalize a leitura.

## Recursos

- **Login com Google** (Firebase Authentication). Sem Firebase configurado, há um modo convidado para desenvolvimento.
- **Estantes**: crie, edite, reordene (arrastar) e mova livros entre estantes arrastando ou pelo menu. Visões "Lendo agora", "Favoritos" e "Sem estante", busca e ordenação.
- **Leitor**: modo páginas ou rolagem, sumário, barra de progresso, posição salva automaticamente, tela cheia e atalhos (← →).
- **Fontes**: as fontes padrão já vêm no sistema; o usuário adiciona mais do Google Fonts (catálogo ou digitando o nome).
- **Ícones**: Material Symbols do Google em 3 estilos; coleção padrão + ícones que o usuário quiser adicionar.
- **Marca-textos**: 9 padrão (preenchimento, meia altura, sublinhado, ondulado, riscado, caixa) e marca-textos personalizados (cor, estilo, intensidade).
- **Comentários e figurinhas** em qualquer trecho: emojis, ícones ou imagens enviadas pelo usuário. Exportação das anotações em Markdown.
- **Papéis** (branco, creme, sépia, reciclado, pergaminho, menta, cinza, noite, preto) e tema claro/escuro/sistema.

## Como rodar

```bash
npm install
npm start          # http://localhost:4200
npm test           # testes unitários (Vitest)
npm run build      # build de produção em dist/
```

### Configurar o login com Google

1. Crie um projeto em <https://console.firebase.google.com>.
2. **Authentication → Sign-in method**: habilite **Google**.
3. **Configurações do projeto → Seus apps**: registre um app Web e copie a configuração.
4. Copie `src/environments/environment.example.ts` para `src/environments/environment.ts` (este fica fora do Git)
   e cole a configuração em `firebase: { apiKey, authDomain, ... }`.
5. Em **Authentication → Settings → Authorized domains**, confirme `localhost` e adicione o domínio de produção.

Opcional: `googleFontsApiKey` no mesmo arquivo lista o catálogo **completo** do Google Fonts
(<https://developers.google.com/fonts/docs/developer_api>). Sem ela é usada uma seleção curada.

## Arquitetura

```
src/app/
├── domain/            Regras puras: entidades, padrões do sistema e contratos (portas) de repositório/autenticação
│   ├── entities/      Book, Shelf, Annotation, Highlighter, FontFamily, Sticker, Paper, ReaderPreferences, User
│   ├── defaults/      Fontes, marca-textos, papéis, figurinhas e ícones que já vêm no sistema
│   └── repositories/  AuthGateway, BookRepository, ShelfRepository, AnnotationRepository…
├── application/       Casos de uso (importar livro, mover entre estantes, criar anotação, gerenciar fontes…)
│   └── ports/         Contratos de serviços externos: ReaderEngine, FontLoader, FontCatalog, BookMetadataExtractor
├── infrastructure/    Implementações concretas, ligadas por DI em infrastructure.providers.ts
│   ├── auth/          Firebase (Google) e convidado
│   ├── persistence/   IndexedDB (idb)
│   ├── fonts/         Google Fonts / Material Symbols
│   ├── parsers/       Metadados e capas (epub.js, pdf.js, parser MOBI próprio)
│   └── readers/       Motores de leitura EPUB, PDF e MOBI + desenho de marcações no DOM
├── presentation/      Componentes Angular Material, stores com signals, páginas, diálogos e guards
└── core/              Utilitários sem dependências de framework (miniaturas, estilos de marca-texto)
```

A dependência só aponta para dentro: `presentation → application → domain`. A `infrastructure`
implementa as portas e é ligada no `app.config.ts`. Para trocar o armazenamento local por
Firestore/Storage (sincronizar entre dispositivos), basta criar novas classes que estendam
`BookRepository`, `AnnotationRepository` etc. e trocar o provider.

### Observações

- Os arquivos dos livros ficam no **IndexedDB do navegador** de cada usuário (não são enviados a servidores).
- PDF tem layout fixo: fonte/entrelinha não se aplicam; o papel vira filtro e há zoom.
- MOBI/AZW/PRC sem DRM (compressões PalmDOC e HUFF/CDIC). Arquivos com DRM são recusados com aviso.
