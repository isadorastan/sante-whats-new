interface LandingPageProps {
  onEnter: () => void
}

const FEATURES = [
  {
    title: 'Agenda semanal',
    text: 'A grade da semana com horário e aluno, no mesmo lugar em que o resto do estúdio mora.',
  },
  {
    title: 'Alunos',
    text: 'Status, data de início, encerramento, dia de vencimento e valor próprio quando a mensalidade foge da tabela.',
  },
  {
    title: 'Tabela e professor',
    text: 'Preço de 1x a 7x por semana, mais o nome e o WhatsApp do professor, em Configurações.',
  },
  {
    title: 'Avisos do dia',
    text: 'Mensagens curtas e variadas para a aula do dia, enviadas uma a uma, com intervalo entre elas.',
  },
  {
    title: 'Resumo da noite',
    text: 'Com a sessão do WhatsApp conectada, o professor recebe à noite a agenda do dia seguinte.',
  },
  {
    title: 'Estatísticas do ano',
    text: 'Receita e quantidade de alunos no ano, atrasos mês a mês, marcar pago e desfazer se marcou sem querer.',
  },
]

const INCLUDED = [
  'Agenda da semana',
  'Cadastro de alunos e mensalidades',
  'Tabela de preços e dados do professor',
  'Avisos do dia no WhatsApp',
  'Resumo da agenda de amanhã',
  'Estatísticas do ano e atrasos',
]

export function LandingPage({ onEnter }: LandingPageProps) {
  return (
    <div className="landing">
      <header className="landing-header">
        <a className="landing-brand" href="#topo">
          <span className="sidebar__mark" aria-hidden />
          <span className="sidebar__title">Agenda Personal</span>
        </a>
        <nav className="landing-nav" aria-label="Seções">
          <a href="#funcionalidades">Funcionalidades</a>
          <a href="#preco">Preço</a>
          <button type="button" className="btn btn--primary" onClick={onEnter}>
            Entrar
          </button>
        </nav>
      </header>

      <main id="topo">
        <section className="landing-hero">
          <p className="landing-kicker">Para personal trainer</p>
          <h1>A semana, os alunos e o WhatsApp no mesmo lugar</h1>
          <p className="landing-lead">
            Monte a grade, cobre a mensalidade e avise a aula do dia sem planilha.
          </p>
          <p className="landing-price-line">
            <span className="landing-price">R$ 59,90</span>
            <span className="landing-price-note">por mês</span>
          </p>
          <a className="btn btn--primary landing-cta" href="#preco">
            Contratar
          </a>
        </section>

        <section className="landing-section" aria-labelledby="dores-titulo">
          <h2 id="dores-titulo">O que hoje toma tempo</h2>
          <ul className="landing-grid">
            <li>
              <h3>Grade espalhada</h3>
              <p>A semana fica no papel, na cabeça ou numa planilha que ninguém abre na hora da aula.</p>
            </li>
            <li>
              <h3>Quem pagou</h3>
              <p>No fim do mês, achar o atraso vira conta de cabeça, aluno por aluno.</p>
            </li>
            <li>
              <h3>Aviso um por um</h3>
              <p>Mandar a mensagem da aula do dia, na mão, come o começo da manhã.</p>
            </li>
          </ul>
        </section>

        <section className="landing-section" aria-labelledby="passos-titulo">
          <h2 id="passos-titulo">Como funciona</h2>
          <ol className="landing-steps">
            <li>
              <h3>Cadastra alunos e a tabela</h3>
              <p>Nome, frequência, vencimento e o preço de 1x a 7x por semana.</p>
            </li>
            <li>
              <h3>Monta a semana</h3>
              <p>Cada aula entra na grade, com horário e aluno.</p>
            </li>
            <li>
              <h3>Avisa e acompanha o mês</h3>
              <p>Manda os avisos do dia no WhatsApp e vê receita, alunos e atrasos.</p>
            </li>
          </ol>
        </section>

        <section className="landing-section" id="funcionalidades" aria-labelledby="funcoes-titulo">
          <h2 id="funcoes-titulo">Funcionalidades</h2>
          <ul className="landing-grid landing-grid--features">
            {FEATURES.map((feature) => (
              <li key={feature.title}>
                <h3>{feature.title}</h3>
                <p>{feature.text}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="landing-section" id="preco" aria-labelledby="preco-titulo">
          <h2 id="preco-titulo">Preço</h2>
          <article className="landing-plan">
            <p className="landing-kicker">Um plano</p>
            <p className="landing-price-line">
              <span className="landing-price">R$ 59,90</span>
              <span className="landing-price-note">por mês</span>
            </p>
            <ul className="landing-included">
              {INCLUDED.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <a className="btn btn--primary landing-cta" href="#preco">
              Contratar
            </a>
          </article>
        </section>

        <section className="landing-section" aria-labelledby="perguntas-titulo">
          <h2 id="perguntas-titulo">Perguntas</h2>
          <dl className="landing-faq">
            <div>
              <dt>Quantos professores entram numa conta?</dt>
              <dd>Um professor por conta.</dd>
            </div>
            <div>
              <dt>Como o WhatsApp conecta?</dt>
              <dd>Lendo um QR no celular. Não é o envio oficial do WhatsApp.</dd>
            </div>
            <div>
              <dt>Posso fechar o computador no meio dos avisos do dia?</dt>
              <dd>
                O envio do dia parte do navegador. A aba precisa ficar aberta até terminar.
              </dd>
            </div>
          </dl>
        </section>
      </main>

      <footer className="landing-footer">
        <p>Agenda Personal</p>
      </footer>
    </div>
  )
}
