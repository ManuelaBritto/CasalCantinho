# Nosso Cantinho — versão beta

Site privado e responsivo para um casal guardar **cartinhas, listas, filmes, vídeos e memórias**, com três temas visuais (Neutro, Drico e Kath), entrada por perfil e animação de boas-vindas personalizada.

Feito em **HTML, CSS e JavaScript puro** (módulos ES), sem framework e sem dependências para instalar.

---

## 1. Como rodar localmente

**Pré-requisito:** Node.js 18 ou mais recente (`node --version`).

```bash
cd nosso-cantinho
npm start          # ou: node servidor-local.mjs
```

Abra **http://localhost:5173**. Não há nada para instalar (`npm install` não é necessário).

Sem Node, também dá para servir os arquivos estáticos (a pesquisa do TMDB fica desativada):

```bash
python3 -m http.server 5173
```

> Abrir o `index.html` direto com duplo clique (`file://`) **não funciona**: navegadores bloqueiam módulos JavaScript nesse modo.

---

## 2. Estrutura do projeto

```
nosso-cantinho/
├── index.html              # Página única; carrega CSS, config.js e js/app.js
├── manifest.webmanifest    # Dados do app instalável (nome, ícones, atalhos)
├── sw.js                   # Service worker: mostra as notificações
├── scripts/                # gerar-chaves-notificacao.mjs (npm run chaves)
├── config.exemplo.js       # Modelo da config pública (o /config.js real é gerado pelo servidor/Vercel)
├── servidor-local.mjs              # Servidor local sem dependências + proxy do TMDB
├── api/                    # Funções da Vercel: config.js, tmdb/search.js e notificar.js
├── lib/                    # Lógica compartilhada (config pública, TMDB e notificações) entre servidor-local.mjs e api/
├── vercel.json             # Vercel: /config.js → função api/config
├── package.json            # Só o script "start"
├── .env.example            # Modelo do arquivo de ambiente
├── css/
│   ├── temas.css           # Variáveis dos 3 temas (cores, fontes, sombras, cinema)
│   ├── base.css            # Reset, layout, menu lateral, navegação no celular
│   ├── componentes.css     # Botões, campos, cartões, modais, avisos, abas…
│   ├── paginas.css         # Estilos de cada área + cartinhas, cinema, galeria
│   ├── boas-vindas.css     # Animações da Kath (girassóis) e do Drico (morcegos)
│   └── recompensas.css     # Estilos de nome, modos da sala, conquistas e comemoração
├── js/
│   ├── app.js              # Inicialização, estrutura, menu e rotas (#/inicio…)
│   ├── auth.js             # Sessão: modo demonstração ou Supabase Auth
│   ├── login.js            # Tela de entrada
│   ├── boas-vindas.js      # Animação de boas-vindas (pulável, respeita movimento reduzido)
│   ├── tema.js             # Troca de tema e preferências visuais
│   ├── config.js           # Lê a config pública
│   ├── notificacoes.js     # Service worker, ativar/desativar e enviar notificações
│   ├── painel-notificacoes.js # Painel em Aparência e convite no Início
│   ├── fila-cinema.js      # Sessões do dia (fila do Cinema)
│   ├── album.js            # Álbum de figurinhas (páginas e espaços)
│   ├── quadro.js           # Quadro de desenho (traços ao vivo, desfazer, exportar PNG)
│   ├── chat-cinema.js      # Chat do Cinema (mensagens, digitando, histórico)
│   ├── sincronia-cinema.js # Sincronia fina do "Assistir junto" (relógio, correção, maestro)
│   ├── bilhetes.js         # Enviar elogio e Lembre de mim (frases, emojis, envio e aviso)
│   ├── recompensas.js      # As 14 recompensas do cinema + contagem do tempo (dados)
│   ├── conquistas.js       # Painel de conquistas, comemoração e colecionáveis (tela)
│   ├── foto-recordacao.js  # Desenha as fotos de recordação (canvas 1080×1350)
│   ├── store/              # CAMADA DE DADOS (separada da interface)
│   │   ├── index.js        # Interface única usada pelas páginas
│   │   ├── local.js        # localStorage (modo demonstração)
│   │   ├── supabase.js     # Supabase (tabelas + Storage)
│   │   ├── exemplos.js     # Conteúdo demonstrativo
│   │   └── imagens.js      # Redução de imagens no navegador
│   ├── paginas/            # Uma página por arquivo
│   │   ├── inicio.js  cartinhas.js  carta-visual.js  listas.js  diversao.js
│   │   └── cinemateca.js  cinema.js  memorias.js  aparencia.js
│   └── ui/                 # Ícones, ilustrações SVG, toasts, modais, utilitários
├── assets/                 # Favicon e ilustrações de exemplo da galeria
└── supabase/schema.sql     # Tabelas, políticas RLS e bucket de fotos (notificacoes.sql: só a parte nova)
```

---

## 3. Funcionalidades

| Área | O que faz |
|---|---|
| **Entrada** | Perfis Kath e Drico. Sessão mantida ao atualizar; botão **Sair** em todo o app. |
| **Boas-vindas** | Kath: "Bem-vinda, Kath!" com girassóis crescendo, pétalas e raposa. Drico: "Bem-vindo, Drico!" com lua, castelo e morcegos voando. Dura ~4 s, tem botão **Pular animação** (ou Esc) e vira cena estática com movimento reduzido. Depois entra com o tema do perfil. |
| **Temas** | Neutro, Drico e Kath. Troca imediata pelo topo ou por **Aparência**; muda cores, fontes, fundos, ilustrações, molduras, galeria e a sala de cinema. Salvo por perfil. |
| **Início** | Frase do tema, foto do casal (ou ilustração), aviso de cartinha nova, **"Estamos juntos?"**, contador de anos/meses/dias com data editável, atalhos, memórias recentes e cartinha em destaque. |
| **Estamos juntos?** | Um botão liga um cronômetro compartilhado: os dois perfis veem o mesmo tempo correndo (também no topo de todas as páginas). Ao encerrar, dá para anotar "como foi" e corrigir o horário de término. Guarda o total juntos, número de encontros, o maior encontro e o histórico (com exclusão). Embaixo aparece uma **curiosidade** comparando o tempo com recordes e fatos (ex.: "Nossa! Vocês ficaram 30 minutos juntos — praticamente o mesmo tempo que o recorde de alguém que ficou embaixo d’água sem respirar"), com a fonte. Os fatos foram pesquisados na web e ficam em `js/curiosidades.js` (fácil de atualizar). |
| **Cartinhas** | **Enviar para o outro perfil** ou guardar como rascunho. Abas Recebidas / Enviadas / Rascunhos; cartinha nova chega num envelope fechado com selo de cera que se abre ao clicar, contador de novas no menu, "lida em…" para quem enviou e botão **Responder**. Rascunhos não aparecem para o outro perfil. Editor com título, como chamar (opcional), data e mensagem; papel (6), cor do papel, cor da tinta, fonte (6), alinhamento, moldura (4) e até 6 enfeites dos três temas. Prévia ao vivo e em tamanho grande. Coleção com abrir, editar e excluir (com confirmação). |
| **Elogio e Lembre de mim** | Dois bilhetes rápidos no topo de Cartinhas. **Enviar elogio**: uma ou duas frases (até 180 caracteres), com sugestões e 4 cores de bilhete. **Lembre de mim**: escolher um de 12 emojis e uma de 18 frases prontas ("Ei, esqueceu de mim?", "Estou com saudades, amor!"…; "Ei, sumida/sumido!" ajusta para quem recebe). Chegam em **Recebidas** como bilhete dobrado, quem enviou vê se já foi visto, e dá para responder com outro elogio ou lembrete. Se a outra pessoa estiver com o site aberto, recebe um aviso na hora (cartinhas normais também); se não, vê o contador e o aviso no Início quando entrar. Ficam salvos na mesma tabela das cartinhas (sem SQL novo). As frases ficam em `js/bilhetes.js`. |
| **Notificações e app** | O site pode ser instalado no celular (ícone, tela cheia, atalhos ao segurar o ícone). Com o login real, cada um ativa as notificações em **Aparência** e recebe aviso de cartinha, elogio e "Lembre de mim" mesmo com o site fechado; tocar na notificação abre direto o que chegou. No Início aparece um convite discreto para ativar. Configuração na seção 6.2. |
| **Listas** | Compartilhadas entre os dois, mostrando quem criou a lista, quem adicionou cada item e quem concluiu. Estilo por lista: cor (8), papel (simples, caderno, post-it, quadriculado, kraft) e adesivo. Criar/renomear/excluir listas com descrição e categoria (6 sugeridas + personalizada); adicionar, editar, concluir e excluir itens (com "Desfazer"); barra de progresso; filtro por categoria. |
| **Cinemateca** | Pesquisa no TMDB com pôsteres (quando configurado), cadastro manual sempre disponível, abas Queremos assistir / Assistindo / Assistidos, detalhes com observações, mudança de status, remoção e bloqueio de duplicatas. |
| **Cinema** | Sala com letreiro, cortinas, moldura e poltronas (muda com o tema). **Assistir junto:** quem coloca um vídeo, dá play, pausa ou avança faz o mesmo acontecer na tela do outro, sem colar link (Realtime do Supabase; no modo demonstração, entre abas do mesmo navegador). **Sincronia fina:** quem agiu por último guia a sessão e manda a posição a cada 2 s; o outro corrige sozinho (até 0,35 s fica como está, até 1,5 s acelera ou desacelera um pouco por alguns segundos, mais que isso pula). O atraso da internet é medido entre os aparelhos, então relógios diferentes no celular e no PC não atrapalham. Se o vídeo de um travar para carregar ou entrar um anúncio, o do outro pausa com "Esperando … carregar…" e os dois voltam juntos. Um selo embaixo do status mostra "Sincronizados" ou "Ajustando a sincronia…". Mostra se o outro está na sala; quem está fora do Cinema recebe aviso "Assistir junto". **Reações** 😂 😢 🍿 😱 que sobem na tela dos dois (inclusive em tela cheia) e ficam contadas por vídeo. Todo vídeo carregado é salvo em **Sessões** (quantas vezes, quando, por quem, se foi junto) e pode ganhar estrela em **Favoritos**. Vídeos que não permitem incorporação mostram aviso + link para o YouTube. |
| **Recompensas do Cinema** | O tempo com vídeo tocando no Cinema é somado para o casal (assistindo juntos, conta uma vez só) e libera **14 recompensas** em ciclos de uma hora: aos **15 min** uma pequena (**colecionável**), aos **30 min** uma média (**visual do site**: estilo de nome ou modo da sala) e na **hora cheia** uma grande (**foto de recordação**). Colecionáveis: ingresso dourado, balde de pipoca, claquete, rolo de filme e troféu. Visuais: nome cromado, nome neon e nome em letreiro (cada um escolhe o seu, aparece no topo e na saudação) e os modos **noir** e **Sala VIP** da sala (valem para os dois). Fotos: polaroid, cartaz do casal, tira de cabine e estrela de cinema, geradas no próprio navegador com o tempo, os vídeos mais vistos, as reações e a foto do casal, prontas para **baixar** ou **compartilhar**. Ao desbloquear aparece uma comemoração (se o vídeo estiver tocando, ela espera a pausa); quem não estava junto vê a comemoração quando entrar. Tudo fica na aba **Conquistas** do Cinema. Os limites ficam em `js/recompensas.js`. |
| **Chat do Cinema** | Conversa do casal ao lado do vídeo (embaixo, no celular). As mensagens chegam na hora; mostra "digitando…", separa por dia e guarda o histórico (últimas 150) na tabela `mensagens`. Cada mensagem marca o ponto do vídeo em que foi escrita ("aos 12:34"): tocar leva os dois para aquele ponto. Link do YouTube no chat vira botão **Colocar na tela**. Mensagens do outro aparecem por cima do vídeo, e em tela cheia aparece um campo para responder sem sair. Fora do Cinema chega um aviso com **Responder**; com o site fechado, uma notificação no celular (no máximo uma a cada 45 s), se estiverem ativadas. |
| **Sessões do dia** | Fila de vídeos do Cinema, a mesma para os dois e só do dia (recomeça vazia no dia seguinte). **Pôr na fila** pelo link ou pelo **+** de um vídeo das Sessões; dá para subir, descer, tirar e tocar agora. Cada vídeo da fila mostra o título, o canal e quem escolheu. **Começar a sessão** toca o primeiro. |
| **Cortina e créditos** | Quando um vídeo novo começa, a cortina fecha e abre (pausar e voltar não repete). No fim do vídeo, a tela mostra os créditos por 5 s: "[vídeo] por [canal]" e "vídeo escolhido por: [nome]", e depois some com fade. Se tiver vídeo na fila, o próximo começa sozinho, com a cortina, para os dois. Em tela cheia, os créditos aparecem, mas a cortina não (ela fica fora da tela cheia). |
| **Chamar para assistir** | Botão **Chamar** no Cinema: mensagem personalizada (com 5 sugestões) e, se houver, o vídeo da tela. O outro recebe uma janela "Fulano te chamou para assistir" com **Entrar no cinema** (ou notificação no celular, se o site estiver fechado). O convite também fica no chat. |
| **Diversão** *(em desenvolvimento)* | **Quadro branco:** desenhos do casal com pincel, borracha, 12 cores + cor livre, 4 espessuras, desfazer/refazer, limpar e baixar em PNG; funciona com dedo, caneta e mouse. Galeria para criar, abrir, editar e excluir. Se os dois abrirem o mesmo desenho, cada traço aparece na hora na tela do outro ("Fulano está neste desenho com você") e o desfazer de um tira só o traço dele. Salva sozinho alguns segundos depois de desenhar. Quando alguém desenha, o outro recebe um aviso (ou notificação no celular) com **Ver**, no máximo um por desenho a cada 10 minutos, e nenhum se os dois estiverem no mesmo desenho. **Álbum de figurinhas** *(em desenvolvimento, no fim da página)*: álbum de 6 páginas com 36 espaços (alguns especiais), ainda sem figurinhas e com todos os textos como "Desenvolvendo"; os títulos reais das páginas ficam guardados em `js/album.js`. **Como eu te vejo:** uma pergunta por dia (30, a mesma para os dois, troca à meia-noite de Brasília), por exemplo "Como eu te vejo se você fosse um animal". Desenha, escreve um recadinho opcional e envia: chega nas **Cartinhas** do outro com aviso/notificação e botão **Desenhar de volta**. As perguntas ficam em `js/paginas/diversao.js`. |
| **Memórias** | Galeria (polaroid no tema Kath, moldura gótica no Drico), visualização ampliada com setas, envio de foto ou URL, legenda e data opcionais. |
| **Aparência** | Cartões de tema com prévia, "ao entrar usar o tema do perfil / o último escolhido", reduzir movimento, decoração discreta, texto maior e (no modo local) restaurar exemplos ou apagar dados. |

**Acessibilidade:** link "Pular para o conteúdo", foco visível, rótulos em todos os campos, botões com nome acessível, `aria-current` no menu, abas navegáveis por setas, modais com `<dialog>` nativo (Esc fecha e o foco volta), avisos em região `aria-live`, ícones SVG + texto (sem depender de emojis), `prefers-reduced-motion` respeitado.

---

## 4. Modo demonstração (padrão)

Enquanto o Supabase **não** estiver configurado:

- A tela de entrada mostra o aviso **"Modo demonstração"** e dois botões: *Entrar como Kath* / *Entrar como Drico*.
- **Não há senha nem autenticação real** — é só a escolha do perfil neste navegador. Nenhuma senha é guardada.
- Os dados ficam no `localStorage`: **não sincronizam entre dispositivos** e **somem se os dados do navegador forem limpos**.
- Kath e Drico compartilham os mesmos dados (é o espaço do casal); o tema é guardado por perfil.
- Há conteúdo de exemplo marcado com o selo **EXEMPLO**: 3 cartinhas, 2 listas, 3 filmes (cadastros manuais, não resultados de pesquisa), 4 ilustrações na galeria e uma **data de exemplo** no contador (1º/01/2024). Nada disso é informação real do casal. Pode editar, excluir ou apagar tudo em **Aparência**.

---

## 5. Configurar o Supabase (login real e sincronização)

> **Atalho:** o arquivo `supabase/instalar-tudo.sql` faz tudo de uma vez (tabelas, regras RLS, contas e vínculo). Cole no SQL Editor e rode; depois siga a partir do passo de **Project Settings → API**.

1. Crie um projeto em https://supabase.com.
2. **SQL Editor → New query**: cole `supabase/schema.sql` e rode. Isso cria as tabelas `casais`, `perfis`, `cartas`, `listas`, `filmes`, `videos`, `memorias`, as políticas **RLS** e o bucket **privado** `memorias`.
3. **Contas de login.** Jeito rápido: rode `supabase/criar-contas.sql` (cria `kathh@nossocantinho.app` com senha `kath1234` e `drico@nossocantinho.app` com senha `drico1234`; **troque as senhas depois**). Ou, manualmente, em **Authentication → Users → Add user → Create new user**, crie as duas contas com estes **e-mails internos** e a senha que cada um vai usar (marque *Auto Confirm User*):
   - `kathh@nossocantinho.app`
   - `drico@nossocantinho.app`

   O login no site é só por **nome + senha**: quem digita "Kath" entra com `kathh@nossocantinho.app`. Nenhum e-mail é enviado para esses endereços. Para usar outro domínio, defina `LOGIN_DOMINIO` no `.env`/Vercel e crie as contas com ele.
4. **Authentication → Sign In / Providers → Email**: desligue *Allow new users to sign up*, para ninguém mais criar conta.
5. *(Para "Assistir junto" no Cinema)* No **SQL Editor**, rode também `supabase/cinema-juntos.sql`. Quem rodou o `schema.sql` depois de 31/10/2026 já tem isso.
6. *(Para guardar o histórico do chat do Cinema)* No **SQL Editor**, rode `supabase/chat-cinema.sql`. Sem ele o chat funciona na hora, mas as mensagens não ficam salvas.
7. *(Para o quadro branco da aba Diversão)* No **SQL Editor**, rode `supabase/diversao.sql`. O "Como eu te vejo" funciona sem ele (os desenhos vão para as cartinhas).
8. No **SQL Editor**, abra uma query nova, cole `supabase/vincular-contas.sql` e rode. Ele já vem com os e-mails internos acima (só mude se trocou o domínio). Pode rodar de novo sem duplicar nada; no fim ele lista as duas contas vinculadas.
7. **Project Settings → API**: copie a *Project URL* e a chave **anon public**.
8. Copie `.env.example` para `.env` e preencha:
   - `.env` linha 10 → `SUPABASE_URL=https://xxxx.supabase.co`
   - `.env` linha 11 → `SUPABASE_ANON_KEY=eyJ...` (a **anon**; o servidor se recusa a iniciar se detectar uma `service_role`)
9. `npm start` de novo. A tela de entrada passa a pedir **nome e senha**.

**Na Vercel**, use as variáveis de ambiente (seção 6.1). **Em outra hospedagem só estática**, copie `config.exemplo.js` para `config.js` e preencha `supabaseUrl` e `supabaseAnonKey`. Essas duas são públicas por natureza — quem protege os dados são as políticas RLS. **Nunca** coloque a `service_role` em nenhum arquivo do front-end.

Como funciona a segurança: a função `meu_casal()` descobre o casal do usuário logado; todas as políticas comparam `casal_id = meu_casal()`, então o banco só devolve dados do próprio casal, mesmo que alguém altere o JavaScript. Usuários não conseguem criar perfis nem trocar de casal; só alteram `perfis.tema_preferido` e `casais.ajustes`. Fotos ficam em `memorias/<id-do-casal>/…` e são exibidas por URLs assinadas temporárias.

---

## 5.1 Vários casais (ex.: Lavi e Marih)

O mesmo site atende vários casais, cada um no próprio cantinho: um casal **nunca** vê os dados, nomes, fotos, chat ou notificações do outro (as regras de segurança do Supabase usam o casal de quem está logado).

1. No **SQL Editor**, rode `supabase/varios-casais.sql` (uma vez; pode rodar de novo sem problema). Ele:
   - libera perfis com qualquer nome (antes só existiam `kath` e `drico`) e acrescenta **apelido** (nome mostrado), **tratamento** (`ela`, `ele` ou `neutro`, usado em "Bem-vinda/Bem-vindo", "Ei, sumida!/sumido!") e **tema_padrao**;
   - completa os dados da Kath e do Drico, sem mexer em nada que já existe;
   - cria o **casal 2**: login `lavi` / senha `lavi1234` e login `marih` / senha `marih1234`.
2. Pronto: no site, cada pessoa entra com o nome de usuário e a senha. **Troque as senhas** depois (Authentication → Users).

Para mudar o tratamento ou o nome mostrado de alguém:
```sql
update public.perfis set tratamento = 'ele', apelido = 'Marih' where nome = 'marih';
```
Para criar outro casal, copie o bloco "Casal 2" de `varios-casais.sql` trocando os nomes, e-mails e senhas.

### Uma pessoa em mais de um casal (ex.: Lavi com a Marih e com o Ric)

Rode também `supabase/pessoa-em-varios-casais.sql` (depois do `varios-casais.sql`). Ele:
- deixa uma conta participar de vários casais: as regras do banco passam a ser "os casais de que a pessoa participa". A Marih continua sem ver nada do Ric, e o Ric nada da Marih;
- cria o **casal 3**: a Lavi (mesma conta) e o Rick, login `rick` (senha inicial `rick1234`; troque depois).

No site, quem participa de mais de um casal escolhe **"Em qual cantinho?"** ao entrar. A escolha fica guardada no aparelho, e **Trocar de cantinho** (no menu) pergunta de novo. O celular dessa pessoa recebe as notificações dos dois cantinhos, e tocar numa delas abre o cantinho de onde ela veio.

## 6. Configurar a API do TMDB (pesquisa de filmes)

1. Crie uma conta em https://www.themoviedb.org e peça uma chave em **Configurações → API**.
2. No `.env`, preencha **uma** das duas:
   - linha 16 → `TMDB_READ_TOKEN=` (token de leitura v4 — recomendado), ou
   - linha 17 → `TMDB_API_KEY=` (chave v3).
3. `npm start`. A Cinemateca passa a mostrar o campo de pesquisa.

A chave fica **só no servidor** (`servidor-local.mjs`, rota `/api/tmdb/search`); o navegador nunca a recebe. Sem chave, a Cinemateca mostra um aviso de configuração e o **cadastro manual continua funcionando**. Na Vercel isso é feito pela função `api/tmdb/search.js` (veja a seção 6.1). Em outra hospedagem só estática, crie um backend equivalente e defina `tmdbProxy: true` nesse `config.js`.

---

## 6.1 Publicar no GitHub e na Vercel

O projeto já vem pronto para a Vercel: o `/config.js` é gerado pela função `api/config.js` e a pesquisa do TMDB roda em `api/tmdb/search.js`. As variáveis de ambiente têm os **mesmos nomes** do `.env`.

**GitHub**
```bash
cd nosso-cantinho
git init
git add .
git commit -m "Nosso Cantinho - beta"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/nosso-cantinho.git
git push -u origin main
```
O `.gitignore` já impede o envio do `.env`. Confira com `git status` antes do primeiro commit: o `.env` **não** pode aparecer na lista.

**Vercel**
1. vercel.com → **Add New → Project** → importe o repositório.
2. *Framework Preset*: **Other**. Deixe *Build Command* e *Output Directory* vazios.
3. Em **Environment Variables**, adicione as que for usar: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `TMDB_READ_TOKEN` (ou `TMDB_API_KEY`) e, para notificações, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` e `VAPID_SUBJECT` (seção 6.2).
4. **Deploy**. Se adicionar ou mudar variáveis depois, faça **Redeploy**: elas só valem a partir do deploy seguinte.
5. Com Supabase: em *Authentication → URL Configuration*, coloque o endereço da Vercel como *Site URL*.

## 6.2 Notificações no celular (opcional)

Com isso, quando um manda **cartinha, elogio ou "Lembre de mim"**, o celular do outro recebe uma notificação, mesmo com o site fechado. Se a pessoa estiver com o site aberto na tela, aparece só o aviso dentro do site.

**1. Banco (uma vez).** No Supabase → *SQL Editor*, rode `supabase/notificacoes.sql`.

**2. Chaves (uma vez).** No seu computador, dentro da pasta do projeto:
```bash
npm install
npm run chaves
```
Aparecem 3 linhas (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`). Cole no `.env` e também na Vercel (*Settings → Environment Variables*, marcando Production e Preview). Depois faça **Redeploy**. A chave privada é secreta: só no `.env` e na Vercel, nunca no GitHub.

**3. Em cada celular.**
- **iPhone (iOS 16.4 ou mais novo):** Safari → *Compartilhar* → *Adicionar à Tela de Início*. Abra o **Cantinho** pelo ícone, entre na conta e vá em **Aparência → Ativar notificações**. A Apple só libera notificações para sites instalados assim. O app instalado guarda o login separado do Safari, então é preciso entrar de novo nele.
- **Android:** no Chrome, **Aparência → Ativar notificações** (funciona direto). Para ter o ícone e os atalhos, use o menu ⋮ → *Instalar app*.
- **Computador:** Chrome ou Edge, **Aparência → Ativar notificações**.

Em **Aparência** tem o botão **Enviar um teste**, que manda uma notificação para os seus próprios aparelhos.

**Como funciona por dentro.** `sw.js` (service worker) recebe e mostra as notificações. `js/notificacoes.js` guarda cada aparelho na tabela `push_inscricoes`. Ao enviar algo, o site chama `api/notificar.js`, que confere o login de quem enviou, busca os aparelhos do outro perfil (as regras do banco só deixam ver os do próprio casal) e entrega pelo serviço de push do navegador (pacote `web-push`). Nenhuma chave secreta do Supabase é usada. Ao **sair da conta**, o aparelho para de receber avisos daquela conta.

**Instalar como app** (`manifest.webmanifest`) também dá o ícone na tela inicial, abertura em tela cheia e atalhos ao segurar o ícone: **Lembre de mim**, **Elogio**, **Cinema** e **Cartinhas**.

---

**Importante:** sem o Supabase, o site publicado fica em **modo demonstração**: qualquer pessoa com o link pode "entrar como Kath ou Drico". Os dados não vazam (cada visitante só vê o que está no próprio navegador), mas o espaço **não é privado**. Configure o Supabase antes de guardar coisas pessoais no site publicado.

---

## 7. O que funciona, o que é simulado e o que depende de fora

- **Funciona de verdade, sem configurar nada:** navegação, temas, preferências, animações, cartinhas, listas, cadastro manual de filmes, cinema com favoritos, galeria com upload, contador — tudo salvo neste navegador.
- **Simulado (claramente sinalizado):** a entrada no modo demonstração (escolha de perfil, sem senha) e o conteúdo com selo EXEMPLO.
- **Depende de serviços externos:**
  - Login real e sincronização → Supabase (código pronto em `js/auth.js` e `js/store/supabase.js`; **não testado contra um projeto real nesta beta**, porque nenhuma credencial foi fornecida).
  - Pesquisa e pôsteres → TMDB (via `servidor-local.mjs`).
  - Reprodução de vídeos e miniaturas → YouTube (player oficial; sem download nem remoção de anúncios/controles).
  - Fontes → Google Fonts (sem internet, o site usa fontes do sistema).

---

## 8. Limitações da beta

- Modo local: espaço limitado do navegador (~5 MB). As fotos são reduzidas, mas cabem algumas dezenas.
- No Supabase, os campos de cada item ficam numa coluna `dados` (jsonb) e os itens das listas ficam dentro da própria lista. É simples e seguro, mas deve ser normalizado depois (ex.: tabela `itens_lista`).
- No modo Supabase, a foto é enviada assim que é escolhida; se a pessoa cancelar o formulário, o arquivo fica no bucket.
- Não há Realtime: o contador de cartinhas novas e o cronômetro "juntos" se atualizam a cada 30–45 s; o resto, ao abrir a página.
- Rascunhos de cartinhas ficam escondidos na interface do outro perfil, mas no banco o casal inteiro tem acesso às linhas (RLS por casal). Para sigilo total, criar uma política que esconda rascunhos de quem não é o autor.
- O título do vídeo é preenchido automaticamente quando o player do YouTube informa; senão, a pessoa digita.
- Sem modo offline/PWA.
- "Assistir junto": navegadores só tocam vídeo com som depois de um toque na página; por isso, ao receber um vídeo, pode aparecer o botão "Assistir junto com …". Com o player oficial do YouTube a sincronia fica, em geral, a menos de meio segundo; acertar o mesmo quadro não é possível. Ao se ajustar, quem está atrasado pode tocar a 1,25x por alguns segundos (o YouTube só oferece velocidades de 0,25 em 0,25).

### Decisões tomadas sem perguntar (fáceis de mudar)

- A animação aparece logo após entrar e uma vez por aba/sessão do navegador; não se repete ao atualizar.
- Ao entrar, aplica-se o tema do perfil (Kath → Kath, Drico → Drico). Em **Aparência** dá para trocar para "o último tema escolhido".
- A tela de entrada usa sempre o tema Neutro.
- Excluir cartinhas, listas, filmes, vídeos e memórias pede confirmação; excluir um **item** de lista é imediato, com botão **Desfazer**.
- Ao mudar o status de um filme, a coleção acompanha o filme até a aba nova.
- Recompensas: o ritmo pedido (15 min / 30 min / 1 h) se repete a cada hora, então as 14 recompensas terminam em 4 h 30 min de cinema. Para espaçar mais, basta mudar os minutos em `js/recompensas.js`.
- Recompensas valem para o casal; o estilo de nome é escolhido por cada um, e o modo da sala é um só para os dois.
- Nenhum vídeo de exemplo foi incluído (não foi possível confirmar links públicos válidos); o campo fica pronto para colar um link.

---

## 9. Testes manuais

Marque cada item depois de testar (use uma janela anônima para começar do zero):

- [ ] `npm start` abre http://localhost:5173 sem erros no console (F12).
- [ ] A tela de entrada mostra o aviso **Modo demonstração**.
- [ ] **Entrar como Kath** → aparece exatamente "Bem-vinda, Kath!" com girassóis e pétalas → entra no tema Kath.
- [ ] Atualizar a página → não pede entrada de novo e não repete a animação.
- [ ] Trocar o tema no topo para Neutro e Drico → tudo muda na hora; atualizar → o tema continua.
- [ ] **Sair** → volta para a entrada. **Entrar como Drico** → "Bem-vindo, Drico!" com morcegos e lua → tema Drico.
- [ ] Na animação, **Pular animação** (ou Esc) encerra na hora.
- [ ] Ativar "reduzir movimento" no sistema (ou em Aparência) → animação estática e curta.
- [ ] Menu lateral: todas as 7 áreas abrem e a atual fica destacada.
- [ ] Celular (ou DevTools em 390 px): barra inferior, botão **Mais** abre o menu, sem rolagem lateral.
- [ ] **Início:** definir a data real no contador; adicionar e remover a foto do casal.
- [ ] **Cartinhas:** criar com papel/fonte/moldura/enfeites, ver a prévia grande, salvar, abrir, editar e excluir.
- [ ] **Elogio e Lembre de mim:** abrir duas abas (uma como Kath, outra como Drico). Enviar um elogio com três frases → recusa; com uma frase → a outra aba recebe o aviso na hora; **Ver** abre o bilhete e marca como visto. Responder com **Lembre de mim** escolhendo emoji e frase → chega na outra aba.
- [ ] **Notificações (com Supabase e chaves configuradas):** em Aparência, **Ativar notificações** → **Enviar um teste** → a notificação chega. No outro celular, mande um elogio com o site do primeiro fechado → chega a notificação; tocar nela abre o elogio. Com o site aberto na tela, aparece só o aviso dentro do site. **Sair da conta** → não chegam mais avisos naquele aparelho.
- [ ] **Listas:** criar lista com categoria personalizada, adicionar 3 itens, concluir 1 (progresso 1 de 3), editar um item, excluir e desfazer, renomear e excluir a lista.
- [ ] **Cinemateca sem chave:** aparece o aviso de configuração; cadastrar filme manual; tentar duplicar (bloqueia); mudar status; observações; remover.
- [ ] **Cinemateca com chave:** pesquisar "Amélie" → resultados reais com pôster → adicionar → aparece "Na coleção".
- [ ] **Cinema:** colar um link do YouTube → toca na tela; salvar nos favoritos; renomear; tocar pelo favorito; tela cheia. Testar um vídeo com incorporação bloqueada → aviso amigável com link.
- [ ] **Recompensas:** tocar um vídeo por alguns segundos e pausar → a aba **Conquistas** mostra o tempo. Para testar rápido no modo demonstração, no console: `a=JSON.parse(localStorage['nc:v1:ajustes']); a.cinemaMs_drico=65*60000; localStorage['nc:v1:ajustes']=JSON.stringify(a)` e atualizar → comemoração da Polaroid; gerar e baixar a foto; usar o nome cromado; ativar o modo noir quando chegar a 1 h 30.
- [ ] **Chat do Cinema:** duas abas (Kath e Drico). Com o Drico fora do Cinema, a Kath manda mensagem → aviso **Responder** abre o chat. Digitar → aparece "digitando…". Mandar um link do YouTube → **Colocar na tela** toca para os dois. Com vídeo tocando, a mensagem aparece por cima do vídeo e o botão "aos …" leva até aquele ponto. Recarregar → histórico continua.
- [ ] **Sessões do dia:** pôr 2 vídeos na fila → aparecem nas duas abas; **Começar a sessão** → a cortina fecha e abre; pausar/voltar não repete a cortina; no fim, créditos por 5 s com quem escolheu, e o próximo vídeo começa para os dois.
- [ ] **Chamar para assistir:** duas abas. Kath coloca um vídeo e toca em **Chamar** → na aba do Drico (fora do Cinema) aparece a janela do convite; **Entrar no cinema** abre o mesmo vídeo e o convite aparece no chat.
- [ ] **Quadro branco:** Drico cria um desenho e desenha; Kath abre o mesmo desenho → os traços de um aparecem no outro na hora; desfazer tira só o próprio traço; voltar à galeria mostra a miniatura.
- [ ] **Como eu te vejo:** desenhar a resposta do dia e enviar → chega nas Cartinhas do outro com o recado; **Desenhar de volta** abre o quadro.
- [ ] **Memórias:** abrir a visualização ampliada, navegar com as setas, enviar uma foto com legenda e data, editar e excluir.
- [ ] **Aparência:** trocar tema pelos cartões; decoração discreta; texto maior; restaurar exemplos.
- [ ] Navegar só com teclado (Tab/Enter/Esc): o foco é sempre visível.
- [ ] Buscar no código: nenhuma chave privada (`service_role`, chave do TMDB) em arquivos do front-end.

---

## 10. Próximos passos sugeridos

1. Criar o projeto Supabase e validar o login real com as duas contas.
2. Normalizar `listas.dados.itens` numa tabela própria e adicionar Supabase Realtime.
3. Trocar a data de exemplo e a ilustração por dados e fotos reais.
4. Publicar na Vercel (seção 6.1) com o Supabase já configurado.
