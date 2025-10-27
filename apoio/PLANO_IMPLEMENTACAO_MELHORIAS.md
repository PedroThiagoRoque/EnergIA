# Plano de Implementação - Melhorias Sistema EnergIA

## Visão Geral
Este documento apresenta um plano detalhado para implementar melhorias no sistema EnergIA, focando na integração de dados climáticos, informações de zona bioclimática, otimização do sistema RAG e correções de implementações superficiais identificadas.

## 📋 Análise da Implementação Atual

### Pontos Fortes Identificados:
- ✅ Sistema de assistentes OpenAI bem estruturado
- ✅ Personalização baseada em perfil do usuário (TCP)
- ✅ Cache de assistentes para otimização
- ✅ Integração com dados meteorológicos básica
- ✅ Análise comportamental do usuário

### Problemas Identificados:
- ❌ Dados climáticos não integrados ao contexto dos assistentes
- ❌ Ausência de informações de zona bioclimática
- ❌ RAG não consultado sistematicamente (apenas na dica do dia)
- ❌ Implementações superficiais em várias funções
- ❌ Duplicação de código e lógica dispersa

---

## 🎯 IMPLEMENTAÇÕES PRIORITÁRIAS

### 1. Integração de Dados Climáticos ao Contexto dos Assistentes

**Objetivo**: Incluir informações meteorológicas em tempo real no prompt de sistema para contextualizar melhor as respostas.

<!-- #### 1.1 Expandir Função getTemperature()
```javascript
// Localização: server.js - linha 25
// Problema: Função retorna apenas temperatura e ícone
// Solução: Expandir para incluir mais dados meteorológicos
```

**Implementar**:
- Adicionar umidade relativa do ar
- Incluir velocidade do vento
- Capturar sensação térmica
- Obter previsão para próximas horas
- Adicionar índice UV quando disponível

#### 1.2 Criar Contexto Climático Estruturado
```javascript
// Novo módulo: src/services/WeatherContextService.js
```

**Funcionalidades**:
- Formatar dados climáticos para inclusão em prompts
- Determinar recomendações baseadas no clima atual
- Cache de dados climáticos (evitar muitas chamadas à API)
- Fallback para dados offline em caso de erro na API

#### 1.3 Integrar ao Sistema de Prompts
**Localização**: `chat.js` - função `buildPersonalizedPrompt()` - linha 15

**Modificações**:
- Adicionar parâmetro `dadosClimaticos` à função
- Incluir seção específica sobre condições climáticas no prompt
- Ajustar recomendações baseadas no clima (ex: uso de ar-condicionado em dias quentes)

--- -->

### 2. Implementação de Contexto de Zona Bioclimática

**Objetivo**: Adicionar informações específicas da zona bioclimática de Pelotas ao contexto do sistema.

#### 2.1 Criar Módulo de Dados Geoclimáticos
```javascript
// Novo arquivo: src/config/geoclimate.js
```

**Dados de Pelotas a incluir**:
- **Zona Bioclimática**: ZB2 (conforme NBR 15220)
- **Coordenadas**: Latitude -31.7692°S, Longitude -52.3410°W
- **Características climáticas**: Subtropical úmido (Cfa - Köppen)
- **Temperatura média anual**: 17.8°C
- **Estratégias recomendadas**: Ventilação cruzada no verão, aquecimento solar passivo no inverno
- **Período de aquecimento**: Maio a Setembro
- **Período de resfriamento**: Dezembro a Março

#### 2.2 Integrar aos Prompts de Sistema
**Modificações necessárias**:
- Adicionar contexto bioclimático constante nos assistentes
- Personalizar recomendações sazonais baseadas na zona
- Incluir estratégias específicas para clima subtropical úmido

#### 2.3 Criar Calendário Sazonal Inteligente
```javascript
// Novo serviço: src/services/SeasonalRecommendationsService.js
```

**Funcionalidades**:
- Determinar estratégias apropriadas por mês/estação
- Sugerir ações preventivas antes de mudanças sazonais
- Recomendar ajustes em equipamentos baseados na época

---

### 3. Otimização e Integração Sistemática do RAG

**Objetivo**: Tornar o sistema RAG parte integral de todas as respostas, não apenas da dica do dia.

#### 3.1 Refatorar Sistema de Assistentes
**Localização**: `chat.js` - função `getOrCreateAssistant()` - linha 211

**Problemas atuais**:
- RAG usado apenas em `getDicaDia()` (linha 70)
- Assistente principal não consulta conhecimento especializado
- Vector store não é utilizado nas conversas principais

**Solução**:
- Criar assistente híbrido que sempre consulta RAG + responde
- Implementar pipeline de: Pergunta → RAG Search → Contexto Especializado → Resposta Final
- Usar file_search em todos os assistentes principais

#### 3.2 Implementar Pipeline RAG Inteligente
```javascript
// Novo serviço: src/services/RAGService.js
```

**Fluxo proposto**:
1. **Análise da pergunta**: Extrair temas e contexto
2. **Busca RAG**: Consultar documentação especializada
3. **Fusão de contexto**: Combinar RAG + perfil usuário + clima + zona bioclimática
4. **Geração de resposta**: Assistente principal com contexto completo
5. **Pós-processamento**: Validação e formatação final

---

### 4. Correções de Implementações Superficiais

#### 4.1 Função `calculaPerfilUsuario()` - Linha 158
**Problemas**:
- Lógica de classificação muito básica
- Thresholds fixos (10, 30 interações) sem justificativa
- Não considera qualidade das interações

**Melhorias**:
- Implementar algoritmo de scoring ponderado
- Considerar padrões temporais de uso
- Incluir análise semântica das perguntas
- Adicionar machine learning simples para classificação

#### 4.2 Função `analisarComplexidadePergunta()` - Linha 131
**Problemas**:
- Lista de termos muito limitada
- Lógica binária simples demais
- Não considera contexto da pergunta

**Melhorias**:
- Implementar análise semântica com embeddings
- Criar taxonomia de temas hierárquica
- Considerar histórico de perguntas similares
- Adicionar detecção de intenção (pergunta, pedido, comparação, etc.)

#### 4.3 Sistema de Temas de Interesse - Linha 396
**Problemas**:
- Detecção por keywords muito básica
- Temas limitados e sobrepostos
- Não evolui dinamicamente

**Melhorias**:
- Implementar classificação automática com NLP
- Criar hierarquia de temas e subtemas
- Sistema de tags dinâmicas
- Análise de co-ocorrência de temas

#### 4.4 Função `getDicaDia()` - Linha 70
**Problemas**:
- Prompts hardcoded e repetitivos
- Não considera histórico de dicas dadas
- Não personaliza para perfil do usuário

**Melhorias**:
- Gerar prompts dinâmicos baseados no perfil
- Evitar repetição de dicas já dadas
- Personalizar para clima atual e sazonalidade
- Incluir nível de complexidade apropriado

---

## 🔧 IMPLEMENTAÇÕES TÉCNICAS ESPECÍFICAS

### 5. Novo Serviço de Contexto Integrado

#### 5.1 Criar ContextService centralizado
```javascript
// Novo arquivo: src/services/ContextService.js
```

**Responsabilidades**:
- Agregar dados climáticos atuais
- Fornecer informações de zona bioclimática
- Consultar RAG para contexto especializado
- Gerar contexto personalizado por usuário
- Cache inteligente de contextos

#### 5.2 Integração com Sistema de Assistentes
**Modificações em**: `chat.js` - função `escolherAssistant()` - linha 488

**Melhorias**:
- Usar ContextService para enriquecer prompts
- Implementar seleção inteligente de assistente baseada em contexto
- Adicionar fallback robusto para diferentes tipos de pergunta

---

### 6. Otimizações de Performance e Arquitetura

#### 6.1 Implementar Rate Limiting Inteligente
```javascript
// Novo middleware: src/middleware/rateLimiting.js
```

**Funcionalidades**:
- Rate limiting por usuário e tipo de operação
- Priorização de usuários por perfil
- Throttling de chamadas custosas (RAG, OpenAI)

#### 6.2 Sistema de Logging e Monitoramento
```javascript
// Novo serviço: src/services/LoggingService.js
```

**Capacidades**:
- Log estruturado de interações
- Métricas de performance de assistentes
- Tracking de custos de API
- Alertas para anomalias

#### 6.3 Refatoração de Gerenciamento de Estado
**Problemas atuais**:
- Cache de assistentes em memória (linha 211)
- Sessions sem persistência robusta
- Estado de conversas não versionado

**Melhorias**:
- Implementar Redis para cache distribuído
- Versioning de estado de conversas
- Backup automático de contextos importantes

---

### 7. Sistema de Feedback e Aprendizado

#### 7.1 Implementar Coleta de Feedback
```javascript
// Nova rota: /chat/feedback
// Novo modelo: src/models/Feedback.js
```

**Funcionalidades**:
- Rating de qualidade das respostas
- Feedback específico sobre precisão de dicas
- Relevância contextual das recomendações

#### 7.2 Sistema de Melhoria Contínua
**Capacidades**:
- Análise de feedback para ajustar prompts
- Identificação de lacunas no conhecimento RAG
- Otimização automática de seleção de assistentes

---

## 📊 CRONOGRAMA SUGERIDO DE IMPLEMENTAÇÃO

### Sprint 1 (1-2 semanas): Fundações
1. **Item 1**: Expandir dados climáticos no server.js
2. **Item 2**: Criar módulo de zona bioclimática
3. **Item 5.1**: Implementar ContextService básico

### Sprint 2 (1-2 semanas): RAG Core
4. **Item 3.1**: Refatorar sistema de assistentes para RAG
5. **Item 3.2**: Implementar pipeline RAG inteligente
6. **Item 1.3**: Integrar clima aos prompts

### Sprint 3 (1-2 semanas): Otimizações
7. **Item 4.1**: Melhorar calculaPerfilUsuario()
8. **Item 4.2**: Aprimorar análise de complexidade
9. **Item 4.3**: Sistema inteligente de temas

### Sprint 4 (1 semana): Refinamentos
10. **Item 4.4**: Otimizar getDicaDia()
11. **Item 6.2**: Implementar logging
12. **Item 7.1**: Sistema de feedback básico

---

## 🎯 RESULTADOS ESPERADOS

### Métricas de Sucesso:
- **Relevância**: 90%+ das respostas incluem contexto climático apropriado
- **Precisão**: 80%+ das recomendações são específicas para ZB2 de Pelotas
- **Engagement**: 50%+ de aumento na aceitação de dicas personalizadas
- **Performance**: <3s tempo médio de resposta mesmo com RAG integrado
- **Qualidade**: 85%+ de feedback positivo dos usuários

### Benefícios Técnicos:
- Código mais modular e maintível
- Sistema de cache otimizado
- Logging e monitoramento adequados
- Pipeline de ML básico para melhorias contínuas
- Arquitetura escalável para novos assistentes

### Benefícios de Negócio:
- Respostas mais precisas e contextualizadas
- Maior retenção de usuários
- Diferenciação competitiva
- Base para funcionalidades avançadas futuras
- Redução de custos operacionais com cache inteligente

---

## 📚 RECURSOS ADICIONAIS NECESSÁRIOS

### APIs e Serviços:
- Manter OpenWeather API (já configurada)
- Considerar API do INMET para dados brasileiros específicos
- Redis para cache distribuído
- Elasticsearch para RAG otimizado (opcional)

### Documentação Técnica:
- Norma NBR 15220 (Zoneamento Bioclimático)
- Manual de eficiência energética residencial
- Guias sazonais de economia de energia

### Ferramentas de Desenvolvimento:
- ESLint/Prettier para qualidade de código
- Jest para testes automatizados
- Winston para logging profissional
- PM2 para deployment em produção

---

## ⚠️ CONSIDERAÇÕES IMPORTANTES

### Riscos Identificados:
1. **Aumento de custos de API**: RAG + OpenAI em todas as respostas
2. **Latência**: Pipeline mais complexo pode impactar performance
3. **Complexity**: Sistema mais difícil de debuggar e manter

### Mitigações:
1. **Cache inteligente** para reduzir chamadas de API
2. **Timeout e fallback** para operações demoradas
3. **Documentação detalhada** e testes automatizados

### Monitoramento Contínuo:
- Custos mensais de API
- Latência média por endpoint
- Taxa de erro de assistentes
- Satisfação dos usuários

---

*Este plano deve ser revisado a cada sprint e ajustado conforme feedback e métricas coletadas durante a implementação.*