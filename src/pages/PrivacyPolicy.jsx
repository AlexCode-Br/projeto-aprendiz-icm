import React from 'react';
import { ArrowLeft, ExternalLink, Mail } from 'lucide-react';
import { Link } from 'react-router-dom';
import Logo from '../assets/projeto-aprendiz-logo.png';

const UPDATED_AT = '29 de setembro de 2026';
const PRIVACY_EMAIL = 'icmprojetoaprendizsalvador@gmail.com';

const sections = [
  ['apresentacao', 'Apresentação'],
  ['responsavel', 'Responsável pelo tratamento'],
  ['dados', 'Dados tratados'],
  ['finalidades', 'Finalidades e bases legais'],
  ['menores', 'Menores de idade e dados sensíveis'],
  ['acesso', 'Acesso e compartilhamento'],
  ['cookies', 'Cookies e armazenamento local'],
  ['retencao', 'Retenção e exclusão'],
  ['seguranca', 'Segurança da informação'],
  ['direitos', 'Direitos do titular'],
  ['responsabilidades', 'Responsabilidades dos usuários'],
  ['atualizacoes', 'Atualizações desta política'],
];

const dataGroups = [
  ['Conta e identificação', 'Nome, e-mail, telefone, perfil de acesso e foto, quando o usuário optar por adicioná-la.'],
  ['Vida acadêmica', 'Cursos, turmas, matrículas, horários, local das aulas, instrumento, classe, frequência e histórico de participação.'],
  ['Responsável legal', 'Nome, telefone e registro de autorização quando o aluno estiver cadastrado na classe Adolescente.'],
  ['Comunicações', 'Publicações e anexos do Mural, comentários, curtidas, confirmações de leitura, informativos e mensagens de suporte.'],
  ['Notificações', 'Preferências do usuário e dados técnicos da assinatura do navegador, apenas quando as notificações forem ativadas.'],
  ['Operação e segurança', 'Endereço IP, datas e horários, identificadores de sessão, navegador, sistema operacional, tentativas de acesso e registros de auditoria.'],
];

const purposeGroups = [
  ['Acesso à plataforma', 'Criar contas, validar credenciais, manter a sessão, recuperar o acesso e confirmar alterações de e-mail.'],
  ['Organização do projeto', 'Administrar turmas, matrículas, calendário, materiais, frequência e acompanhamento dos participantes.'],
  ['Comunicação', 'Disponibilizar o Mural, publicar informativos, responder chamados e entregar notificações solicitadas.'],
  ['Proteção do ambiente', 'Prevenir abuso e fraude, limitar tentativas de login, investigar falhas e manter registros de segurança.'],
  ['Prestação de contas', 'Cumprir obrigações legais, atender autoridades competentes e resguardar direitos do projeto e dos titulares.'],
  ['Aprimoramento', 'Produzir indicadores internos com informações agregadas ou anonimizadas, sem finalidade publicitária.'],
];

const Section = ({ id, number, title, children }) => (
  <section id={id} className="min-w-0 scroll-mt-28 border-b border-slate-200 pb-10 last:border-b-0 last:pb-0">
    <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Seção {number}</p>
    <h2 className="mt-2 text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">{title}</h2>
    <div className="mt-5 space-y-4 text-[0.95rem] leading-7 text-slate-700">{children}</div>
  </section>
);

const DefinitionRows = ({ items }) => (
  <dl className="min-w-0 max-w-full overflow-hidden rounded-xl border border-slate-200">
    {items.map(([term, description]) => (
      <div key={term} className="grid gap-1 border-b border-slate-200 px-4 py-4 last:border-b-0 sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-5 sm:px-5">
        <dt className="font-semibold text-slate-950">{term}</dt>
        <dd className="text-slate-700">{description}</dd>
      </div>
    ))}
  </dl>
);

const PrivacyPolicy = () => (
  <main className="min-h-screen bg-[#f5f6f7] text-slate-950 [color-scheme:light]">
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-4 px-4 py-2 sm:px-6 lg:px-8">
        <Link to="/login" className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2" aria-label="Voltar ao login">
          <img src={Logo} width="300" height="149" alt="Projeto Aprendiz" className="h-auto w-28 sm:w-32" />
        </Link>
        <Link to="/login" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-primary hover:text-primary">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Voltar ao login
        </Link>
      </div>
    </header>

    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <div className="rounded-2xl border border-slate-200 bg-white px-5 py-8 shadow-sm sm:px-10 sm:py-10">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Documento público</p>
        <h1 className="mt-3 max-w-3xl text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Política de Privacidade do Projeto Aprendiz</h1>
        <p className="mt-5 max-w-3xl text-base leading-7 text-slate-600">
          Este documento informa como os dados pessoais são utilizados na plataforma do Projeto Aprendiz, quais medidas são adotadas para protegê-los e como seus titulares podem exercer os direitos previstos na Lei Geral de Proteção de Dados Pessoais — LGPD.
        </p>
        <div className="mt-6 flex flex-wrap gap-x-8 gap-y-2 border-t border-slate-200 pt-5 text-sm text-slate-600">
          <p><span className="font-semibold text-slate-950">Última atualização:</span> {UPDATED_AT}</p>
          <p><span className="font-semibold text-slate-950">Versão:</span> 1.0</p>
        </div>
      </div>

      <div className="mt-5 border-l-4 border-primary bg-white px-5 py-4 text-sm leading-6 text-slate-700 shadow-sm">
        <strong className="text-slate-950">Importante:</strong> esta plataforma atende exclusivamente ao Projeto Aprendiz do Maanaim de Salvador. Trata-se de uma iniciativa independente, que não constitui um canal oficial nem representa institucionalmente a Igreja Cristã Maranata.
      </div>

      <div className="mt-8 grid min-w-0 items-start gap-8 lg:grid-cols-[230px_minmax(0,1fr)]">
        <aside className="hidden rounded-xl border border-slate-200 bg-white p-4 lg:sticky lg:top-24 lg:block" aria-label="Sumário da política">
          <p className="px-2 pb-3 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Sumário</p>
          <nav>
            <ol className="space-y-0.5">
              {sections.map(([id, label], index) => (
                <li key={id}>
                  <a href={`#${id}`} className="grid grid-cols-[1.5rem_1fr] rounded-md px-2 py-2 text-sm leading-5 text-slate-600 transition hover:bg-slate-100 hover:text-slate-950">
                    <span className="text-slate-400">{index + 1}.</span>
                    <span>{label}</span>
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        </aside>

        <article className="min-w-0 max-w-full space-y-10 rounded-2xl border border-slate-200 bg-white px-5 py-8 shadow-sm sm:px-10 sm:py-10">
          <Section id="apresentacao" number="01" title="Apresentação">
            <p>O Projeto Aprendiz utiliza uma plataforma digital para apoiar a gestão de turmas, o registro de frequência e a comunicação entre gestores, professores, alunos e responsáveis. O tratamento de dados pessoais é restrito ao funcionamento dessas atividades.</p>
            <p>Esta política se aplica ao site <strong>aprendizicm.com.br</strong>, ao aplicativo instalável, às contas de acesso e às comunicações enviadas pelo sistema. Ela deve ser lida por todos os usuários e, no caso de menores de idade, também pelo responsável legal.</p>
            <div className="rounded-xl bg-slate-50 px-5 py-4 text-sm leading-6 text-slate-700">
              O Projeto Aprendiz não vende cadastros, não utiliza dados para publicidade comportamental e não solicita informações bancárias ou de pagamento.
            </div>
          </Section>

          <Section id="responsavel" number="02" title="Responsável pelo tratamento">
            <p>Para os fins da LGPD, o controlador dos dados pessoais tratados nesta plataforma é:</p>
            <div className="rounded-xl border border-slate-200 px-5 py-4">
              <p className="font-semibold text-slate-950">Alexandre Souza Silva</p>
              <p className="mt-1 text-sm text-slate-600">Responsável pelo Projeto Aprendiz</p>
              <a href={`mailto:${PRIVACY_EMAIL}`} className="mt-3 inline-flex max-w-full items-center gap-2 break-all font-semibold text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-primary">
                <Mail className="h-4 w-4" aria-hidden="true" />
                {PRIVACY_EMAIL}
              </a>
            </div>
            <p>Esse canal pode ser utilizado para dúvidas sobre esta política e para solicitações relacionadas a dados pessoais. A identidade do solicitante poderá ser confirmada antes do atendimento, como medida de proteção contra pedidos indevidos.</p>
          </Section>

          <Section id="dados" number="03" title="Dados pessoais tratados">
            <p>Os dados variam de acordo com o perfil do usuário e com as funcionalidades utilizadas:</p>
            <DefinitionRows items={dataGroups} />
            <p>A foto de perfil é opcional e não é utilizada para reconhecimento facial. As informações podem ser fornecidas pelo titular ou responsável, cadastradas pela gestão, registradas pelo professor durante as atividades ou geradas automaticamente pelo uso da plataforma.</p>
          </Section>

          <Section id="finalidades" number="04" title="Finalidades e bases legais">
            <p>O Projeto Aprendiz trata dados pessoais para as seguintes finalidades:</p>
            <DefinitionRows items={purposeGroups} />
            <p>Conforme a operação, o tratamento poderá se fundamentar na execução das atividades solicitadas pelo participante, no cumprimento de obrigação legal, no exercício regular de direitos, no legítimo interesse de manter o serviço organizado e seguro ou no consentimento do titular ou responsável legal.</p>
            <p>Quando a lei exigir consentimento específico, ele será solicitado de forma separada e poderá ser revogado. A simples utilização do sistema ou leitura desta política não será apresentada como consentimento para finalidades que dependam dessa autorização.</p>
          </Section>

          <Section id="menores" number="05" title="Menores de idade e dados potencialmente sensíveis">
            <p>O nome da igreja ou localidade do participante pode revelar informação sobre convicção religiosa. Por esse motivo, seu uso é limitado à organização das turmas e protegido com os mesmos controles aplicados aos demais dados sensíveis.</p>
            <p>O tratamento de dados de crianças e adolescentes deve atender ao seu melhor interesse. Não existe cadastro público de alunos: a conta é vinculada a um cadastro acadêmico e liberada por convite. Para alunos registrados na classe Adolescente, o sistema mantém os dados e a autorização do responsável legal.</p>
            <p>Menores não devem publicar telefones, endereços, documentos ou outras informações pessoais no Mural. Conteúdos inadequados poderão ser moderados pelo professor responsável ou pela gestão.</p>
          </Section>

          <Section id="acesso" number="06" title="Acesso interno e compartilhamento">
            <p>As permissões são definidas pela função e pelo vínculo acadêmico. O aluno acessa seus próprios dados e as turmas em que está matriculado. O professor acessa os dados necessários dos alunos de suas turmas. A gestão administra cadastros, matrículas e o funcionamento geral do sistema.</p>
            <p>Publicações e anexos do Mural podem ser visualizados pelos participantes da respectiva turma, pelo professor responsável e pela gestão, quando necessário à moderação. Informações de uma turma não são disponibilizadas a alunos de outras turmas.</p>
            <p>Alguns fornecedores processam dados estritamente para viabilizar o serviço:</p>
            <ul className="list-disc space-y-2 pl-5 marker:text-primary">
              <li><strong>Supabase:</strong> autenticação, banco de dados e armazenamento privado de arquivos;</li>
              <li><strong>Cloudflare:</strong> hospedagem, entrega do site, segurança, conexão com o banco e desafio Turnstile;</li>
              <li><strong>Resend:</strong> entrega de e-mails transacionais, como convites e recuperação de senha;</li>
              <li><strong>serviços de Web Push:</strong> entrega de notificações nos dispositivos que tenham recebido autorização do usuário.</li>
            </ul>
            <p>O tratamento poderá ocorrer fora do Brasil em razão da infraestrutura desses fornecedores, observadas as garantias aplicáveis. Dados também poderão ser fornecidos a autoridades públicas diante de obrigação legal ou ordem válida. Não há compartilhamento para comercialização de cadastros.</p>
          </Section>

          <Section id="cookies" number="07" title="Cookies e armazenamento local">
            <p>A plataforma utiliza um cookie estritamente necessário para autenticação. Ele é protegido, restrito ao domínio e não pode ser lido por scripts da página. Sem a opção “Permanecer conectado”, o cookie é encerrado quando o navegador é fechado; o registro correspondente possui limite técnico de até oito horas no servidor. Com a opção ativada, a sessão pode permanecer válida por até 30 dias.</p>
            <p>O armazenamento local do navegador registra apenas preferências essenciais, como a escolha de manter a sessão. O Service Worker armazena o conteúdo público necessário à instalação do aplicativo, sem guardar respostas privadas da API.</p>
            <p>Após tentativas repetidas de login, o Cloudflare Turnstile poderá tratar informações técnicas para verificar se a solicitação foi feita por uma pessoa. Não são instalados cookies de publicidade comportamental.</p>
          </Section>

          <Section id="retencao" number="08" title="Retenção, exclusão e anonimização">
            <p>Os dados são conservados enquanto a conta ou o vínculo acadêmico estiver ativo e, depois disso, pelo período necessário à segurança, à prestação de contas ou ao cumprimento de obrigação legal.</p>
            <ul className="list-disc space-y-2 pl-5 marker:text-primary">
              <li>links de recuperação de senha expiram em 30 minutos;</li>
              <li>convites de acesso expiram em 48 horas;</li>
              <li>sessões persistentes podem durar até 30 dias e podem ser encerradas pelo usuário;</li>
              <li>a exclusão da conta revoga sessões e notificações e remove ou substitui os dados identificadores da conta;</li>
              <li>no perfil de aluno, excluir a conta de acesso não elimina automaticamente o cadastro acadêmico administrado pelo projeto;</li>
              <li>a anonimização do cadastro do aluno remove nome, e-mail, telefone, responsável, igreja e classe, preservando somente registros acadêmicos sem identificação quando necessários a estatísticas;</li>
              <li>registros técnicos, de segurança e auditoria podem ser mantidos pelo período necessário à comprovação das operações.</li>
            </ul>
            <p>Quando não houver outra base legal para conservação, os dados serão eliminados ou anonimizados.</p>
          </Section>

          <Section id="seguranca" number="09" title="Segurança da informação">
            <p>O sistema utiliza conexão HTTPS, sessões protegidas, controle de acesso por perfil e turma, validação de permissões no servidor, armazenamento privado de arquivos, limitação de tentativas de login, proteção contra automação e trilhas de auditoria.</p>
            <p>Senhas não são exibidas a gestores, professores ou alunos. Apesar dos cuidados adotados, nenhum serviço conectado à internet é totalmente imune a incidentes. Ocorrências relevantes serão investigadas, contidas e comunicadas aos titulares e à autoridade competente quando a legislação assim determinar.</p>
          </Section>

          <Section id="direitos" number="10" title="Direitos do titular">
            <p>O titular ou seu responsável legal pode solicitar, nos limites previstos na LGPD:</p>
            <ul className="list-disc space-y-2 pl-5 marker:text-primary">
              <li>confirmação da existência de tratamento e acesso aos dados;</li>
              <li>correção de dados incompletos, inexatos ou desatualizados;</li>
              <li>anonimização, bloqueio ou eliminação de dados desnecessários, excessivos ou tratados de forma irregular;</li>
              <li>informações sobre compartilhamento e sobre as consequências de negar ou revogar consentimento;</li>
              <li>portabilidade, quando regulamentada e tecnicamente aplicável;</li>
              <li>revogação do consentimento e eliminação dos dados tratados exclusivamente com essa base, ressalvadas as hipóteses legais de conservação;</li>
              <li>oposição a tratamento realizado em desconformidade com a lei;</li>
              <li>revisão de decisão automatizada que afete seus interesses, caso esse tipo de decisão venha a ser utilizado.</li>
            </ul>
            <p>Algumas informações podem ser corrigidas diretamente em Configurações. Os demais pedidos podem ser feitos pelo suporte do sistema ou pelo e-mail <a href={`mailto:${PRIVACY_EMAIL}`} className="break-all font-semibold text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-primary">{PRIVACY_EMAIL}</a>.</p>
            <a href="https://www.gov.br/anpd/pt-br/assuntos/titular-de-dados-1/direito-dos-titulares" target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:border-primary hover:text-primary">
              Direitos dos titulares na ANPD
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
            </a>
          </Section>

          <Section id="responsabilidades" number="11" title="Responsabilidades dos usuários">
            <p>Os usuários devem fornecer informações corretas, manter seus dados atualizados e preservar a confidencialidade de suas credenciais. Senhas e links de acesso não devem ser compartilhados.</p>
            <p>Publicações, comentários e anexos não devem conter documentos pessoais, dados de saúde, informações privadas de terceiros ou conteúdo incompatível com as atividades do projeto. O autor é responsável pelo conteúdo que publica, sem prejuízo da atuação de moderação.</p>
          </Section>

          <Section id="atualizacoes" number="12" title="Atualizações desta política">
            <p>Esta política poderá ser alterada para refletir mudanças na plataforma, nos fornecedores ou na legislação. A versão atual permanecerá disponível neste endereço, acompanhada da data de atualização. Mudanças relevantes poderão ser comunicadas dentro do sistema ou pelos contatos cadastrados.</p>
            <p>Esta política é regida pela legislação brasileira, especialmente pela Lei nº 13.709/2018.</p>
            <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 px-5 py-5">
              <p className="font-semibold text-slate-950">Canal de privacidade</p>
              <p className="mt-1 text-sm text-slate-600">Dúvidas e solicitações relacionadas a dados pessoais.</p>
              <a href={`mailto:${PRIVACY_EMAIL}`} className="mt-3 inline-flex min-h-11 max-w-full items-center gap-2 break-all font-semibold text-primary hover:underline">
                <Mail className="h-4 w-4" aria-hidden="true" />
                {PRIVACY_EMAIL}
              </a>
            </div>
          </Section>
        </article>
      </div>
    </div>
  </main>
);

export default PrivacyPolicy;
