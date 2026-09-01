# Privacidade e retenção de dados

O Projeto Aprendiz aplica minimização de dados ao cadastro de alunos e registra a autorização do responsável legal quando a classe selecionada é **Adolescente**.

## Exclusão de aluno

Quando o gestor confirma a exclusão, o sistema realiza uma anonimização irreversível:

- remove nome, e-mail, telefones, responsável, igreja de origem e classe etária;
- apaga os registros livres de contato, que podem conter informações pessoais;
- revoga as matrículas ativas e o acesso operacional ao cadastro;
- mantém apenas matrículas, presenças e categorias de evasão sem identificação pessoal, necessárias aos indicadores históricos;
- substitui justificativas livres de evasão por um texto neutro;
- registra data e operador da anonimização para auditoria interna.

Após esse processo não existe função de restauração do cadastro. Uma nova participação exige um novo cadastro e, no caso de menor, uma nova confirmação do responsável.

## Retenção

Dados pessoais de alunos ativos permanecem enquanto necessários à gestão das atividades. A exclusão solicitada pelo gestor elimina imediatamente esses dados pessoais. Registros acadêmicos anonimizados podem ser mantidos para estatísticas institucionais, pois não permitem identificar o titular a partir do sistema.

Logs técnicos e de auditoria não armazenam os dados pessoais removidos; guardam somente identificadores internos da operação e do usuário responsável pela ação.
