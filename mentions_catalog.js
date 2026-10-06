/*
 * Observatoire Prestaterre — V6.14 — catalogue normatif des mentions (données).
 *
 * Ce fichier ne contient que des règles relevées dans les référentiels effectivement fournis.
 * Chaque règle cite sa source (document, version, pages). Une mention dont le document n'a pas
 * été fourni figure avec `criteria: null` et le statut `source_missing` : elle est listée mais
 * jamais calculée. Aucune règle d'une version n'est transposée à une autre version.
 *
 * Grammaire des critères (voir newosb-mentions.js) :
 *   { type:'req', code, alt:[...], inferredAlt:[...], when:{field, applicableIf:'oui'} }
 *       une exigence ; `alt` = alternatives explicitement écrites dans le référentiel ;
 *       `inferredAlt` = niveaux supérieurs probables mais NON écrits : ne valent jamais une coche verte.
 *   { type:'any', label, items:[...] }        1 unité, couverte si une alternative est couverte
 *   { type:'all', label, items:[...] }        1 unité (groupe), couverte si tout le groupe l'est
 *   { type:'atLeast', k, label, items:[...] } k unités
 *   { type:'mention', id }                    dépendance à une autre mention
 *   { type:'unknown', reason }                critère non déterminable à partir de la source
 */
(function (root) {
  'use strict';

  const LR2025 = 'BEE_LR@2025-06-18';
  const SRC_LR2025 = { doc: 'REF AN 010-3 BEE Logement Rénovation', version: '18/06/2025' };
  const concerned = (code, label) => ({ id: `lr2025.concerne.${code}`, label: `« ${code} ${label} » est concernée par les travaux de rénovation`, values: [['oui', 'Oui'], ['non', 'Non']] });

  // ================================================================== BEE Logement Neuf 04/05/2026
  // Source : REF AN 010-1, version du 04/05/2026 (PDF de 106 pages), d'après le dossier d'extraction
  // « BEE_Logement_Neuf_2026_Mentions_pour_Claude.txt » transmis avec la demande (pages du PDF citées).
  const LN2026 = 'BEE_LN@2026-05-04';
  const SRC_LN = { doc: 'REF AN 010-1 BEE Logement Neuf', version: '04/05/2026' };
  const req = (code, extra = {}) => ({ type: 'req', code, ...extra });
  const any = (label, codes, extra = {}) => ({ type: 'req', code: codes[0], alt: codes.slice(1), label, ...extra });
  const range = (prefix, from, to) => Array.from({ length: to - from + 1 }, (_, i) => `${prefix}.${from + i}`);
  const notIndividual = text => ({ field: 'ln2026.buildingType', notIn: ['individuel_isole', 'individuel_groupe'], text });
  const regime = (value, text) => ({ field: 'ln2026.regime', in: [value], text });
  const PC_BEFORE_2025 = ['avant2024', '2024'];
  const PC_FROM_2025 = ['2025_2027', '2028plus'];
  const pcSwitch = (label, before, after) => ({ type: 'switch', field: 'ln2026.permit', label, cases: { avant2024: before, '2024': before, '2025_2027': after, '2028plus': after } });
  const regimeSwitch = (label, rt, re) => ({ type: 'switch', field: 'ln2026.regime', label, cases: { RT2012: rt, RE2020: re } });
  const ext = text => ({ text });
  const effinergieExt = { text: 'Règles techniques extérieures de l’association Effinergie requises (non fournies) : non évaluées ici.' };
  const p = (pages, extra = '') => ({ ...SRC_LN, pages: pages + extra });
  const base145 = { points: { required: true, text: 'Seuil de 145 points (p. 11-12, p. 98).' }, cumulation: { cumulable: true, text: 'Cumul de mentions autorisé (p. 98).' } };
  const alone = { points: { required: 'conditional', text: 'Dérogation au seuil de 145 points si la mention est retenue seule ; 145 points en cas de cumul (p. 11-12, p. 98).' }, cumulation: { cumulable: true, text: 'Cumulable ; le seuil de 145 points s’applique alors (p. 98).' } };
  const common = { optional: [], recommended: [], prerequisites: [], dependencies: [], applicability: [], ambiguities: [], verification: 'verified' };
  const m = (id, name, kind, def) => ({ id: `BEE_LN_2026_${id}`, context: LN2026, name, kind, ...common, ...base145, ...def });

  function lnMentions() {
    return [
      m('BPE', 'Bâtiment Performance Énergétique (BPE)', 'Prestaterre', {
        sources: [p('12'), p('100-103', ' (annexe 2)')],
        applicability: [regime('RT2012', 'RT 2012 uniquement (p. 12).')],
        criteria: { type: 'all', items: [any('Un ensemble éligible : niveau 3.1.1, 3.1.2 ou 3.1.3 (A) et/ou Passif 3.1.4 (B)', ['3.1.1', '3.1.2', '3.1.3', '3.1.4'])] },
        points: { required: false, text: 'Pas de seuil de 145 points (p. 11-12).' },
        cumulation: { cumulable: false, text: 'Mention autonome, non cumulable avec d’autres mentions (p. 11-12, p. 98).' },
        ambiguities: [{ id: 'A', affectsScore: true, text: 'p. 12 : ensembles A et B pris séparément ou cumulés ; l’annexe porte X sur 3.1.1. Le caractère obligatoire de 3.1.1 n’est pas tranché.' }]
      }),
      m('BPEC', 'Bâtiment Performance Énergétique et Carbone (BPEC)', 'Prestaterre', {
        sources: [p('12'), p('54-56'), p('100-103', ' (annexe 2)')],
        applicability: [regime('RE2020', 'RE 2020 uniquement (p. 12).')],
        criteria: { type: 'all', items: [req('3.3.1', { label: '3.3.1 Niveau RE 2020 (exigence minimale)' })] },
        optional: [...range('3.3', 2, 19)],
        points: { required: false, text: 'Pas de seuil de 145 points (p. 11-12).' },
        cumulation: { cumulable: false, text: 'Mention autonome, non cumulable avec d’autres mentions (p. 11-12, p. 98).' },
        prerequisites: [ext('Ensembles Cep, Cep,nr, Bbio, IC Énergie, IC Construction et Passif pris séparément ou cumulés ; pas de cumul de niveaux dans un même groupe (p. 12).')],
        ambiguities: [{ id: 'B', affectsScore: true, text: 'p. 12 : « deux » niveaux IC Énergie pour trois codes et « trois » niveaux IC Construction pour quatre codes ; articulation entre « 3.3.1 exigence minimale » et « ensembles pris séparément » à interpréter.' }]
      }),
      m('BEE_PLUS', 'BEE+', 'Prestaterre', {
        sources: [p('12-13'), p('100-103', ' (annexe 2)')],
        criteria: { type: 'all', items: [
          req('1.2.1'), req('1.2.2'), req('1.2.3'), req('2.3.1'),
          regimeSwitch('Performance supérieure au réglementaire applicable',
            any('RT 2012 : 3.1.2 ou 3.1.3', ['3.1.2', '3.1.3']),
            pcSwitch('RE 2020 : niveau supérieur au réglementaire selon la date de dépôt du PC',
              any('RE 2020, PC avant 2025 : un niveau parmi 3.3.2 à 3.3.11, 3.3.13, 3.3.14, 3.3.16 à 3.3.18', [...range('3.3', 2, 11), '3.3.13', '3.3.14', '3.3.16', '3.3.17', '3.3.18']),
              any('RE 2020, PC à compter de 2025 : un niveau Cep, Cep,nr ou Bbio (3.3.2 à 3.3.11) ou IC 2028/2031 (3.3.14, 3.3.17, 3.3.18)', [...range('3.3', 2, 11), '3.3.14', '3.3.17', '3.3.18']))),
          req('4.1.1'), req('4.1.2'),
          { type: 'switch', field: 'ln2026.buildingType', label: 'Acoustique', cases: {
            collectif: any('Collectif : un niveau parmi 4.3.4, 4.3.5, 4.3.6', ['4.3.4', '4.3.5', '4.3.6']),
            individuel_isole: req('4.3.9', { label: 'Maison individuelle isolée : 4.3.9' }),
            individuel_groupe: { type: 'unknown', label: 'Acoustique (individuel groupé)', reason: 'Règle non précisée pour l’individuel groupé (ambiguïté D)' } } },
          req('4.6.1')
        ] },
        prerequisites: [ext('Les seuls codes réglementaires 3.3.12 et 3.3.15 ne prouvent pas un dépassement du réglementaire (p. 12).'), ext('PC à compter du 01/01/2025 : les seuils IC 2025 doivent être accompagnés d’un niveau Cep, Bbio ou Cep,nr supérieur à la réglementation (p. 12).')],
        ambiguities: [
          { id: 'C', affectsScore: false, text: '3.3.29 (Performance renforcée) est colorée dans la colonne BEE+ mais absente de la plage narrative p. 12 : non retenue comme alternative.' },
          { id: 'D', affectsScore: true, when: { field: 'ln2026.buildingType', applicableIf: ['individuel_groupe'] }, text: 'Règle acoustique non précisée pour l’individuel groupé.' }
        ]
      }),
      m('TFPB', 'Option TFPB', 'Prestaterre', {
        sources: [p('10-11'), p('13'), p('54-56')],
        criteria: { type: 'all', items: [
          { type: 'switch', field: 'ln2026.permit', label: 'Niveaux IC exigés selon la date de dépôt du PC', cases: {
            avant2024: req('3.3.16', { label: 'PC déposé jusqu’au 31/12/2023 : IC Construction 2025 (3.3.16)' }),
            '2024': { type: 'all', label: 'PC 2024 : IC Énergie 2025 (3.3.13) et IC Construction 2025 (3.3.16)', items: [req('3.3.13'), req('3.3.16')] },
            '2025_2027': { type: 'all', label: 'PC 2025-2027 : IC Énergie 2028 (3.3.14) et IC Construction 2028 (3.3.17)', items: [req('3.3.14'), req('3.3.17')] },
            '2028plus': { type: 'all', label: 'PC à compter de 2028 : IC Énergie 2028 (3.3.14) et IC Construction 2031 (3.3.18)', items: [req('3.3.14'), req('3.3.18')] } } }
        ] },
        prerequisites: [ext('Éligibilité fiscale non démontrée par les seuls codes ; décret n° 2023-560 du 03/07/2023 (p. 11).'), ext('Date de dépôt du PC (et non date d’accord) ; pour un dépôt avant le 31/12/2023, ouverture de chantier non réalisée avant le 01/04/2023 (p. 10-11).')],
        ambiguities: [{ id: 'K', affectsScore: false, text: 'p. 10 « avant le 31 décembre 2023 » / tableau p. 11 « jusqu’au 31 décembre 2023 ».' }]
      }),
      m('HABITAT_QUALITE', 'Habitat Qualité', 'Prestaterre', {
        sources: [p('13'), p('100-103', ' (annexe 2)')],
        applicability: [notIndividual('Non applicable à la maison individuelle (p. 13).')],
        criteria: { type: 'all', items: [
          regimeSwitch('Niveau énergétique', any('RT 2012 : 3.1.1, 3.1.2 ou 3.1.3', ['3.1.1', '3.1.2', '3.1.3']), any('RE 2020 : 3.3.1, 3.3.2, 3.3.3 ou 3.3.4', ['3.3.1', '3.3.2', '3.3.3', '3.3.4'])),
          req('4.1.1'), req('4.1.2'),
          { type: 'mention', id: 'BEE_LN_2026_EVALUATION_CHARGES' },
          { type: 'mention', id: 'BEE_LN_2026_ACOUSTIQUE_RENFORCEE' },
          req('4.3.7', { ambiguity: 'E' }), req('4.3.8'), req('4.6.1')
        ] },
        ambiguities: [{ id: 'E', affectsScore: false, text: 'p. 13 rend 4.3.7 obligatoire ; l’annexe p. 103 colore la case sans X. L’obligation narrative est conservée ; arbitrage à confirmer.' }]
      }),
      m('EVALUATION_CHARGES', 'Évaluation des charges', 'Prestaterre', {
        aliases: ['Évaluations des charges'],
        sources: [p('13'), p('98'), p('100-103', ' (annexe 2)')],
        applicability: [notIndividual('Non applicable à la maison individuelle (p. 13).')],
        criteria: { type: 'all', items: [any('Un niveau parmi 3.7.1, 3.7.2, 3.7.3', ['3.7.1', '3.7.2', '3.7.3'])] }
      }),
      m('QAI', 'Qualité de l’air intérieur', 'Prestaterre', {
        sources: [p('13'), p('100-103', ' (annexe 2)')],
        criteria: { type: 'all', items: [{ type: 'atLeast', k: 2, label: 'Au moins deux exigences parmi 4.4.1 à 4.4.5', items: [
          req('4.4.1'), req('4.4.2'),
          req('4.4.3', { when: { field: 'ln2026.regime', applicableIf: ['RT2012'] }, label: '4.4.3 Ventilation (RT 2012 uniquement)' }),
          req('4.4.4'),
          req('4.4.5', { when: { field: 'ln2026.concerne.4.4.5' }, label: '4.4.5 Radon (si concerné)' })
        ] }] }
      }),
      m('ACOUSTIQUE_RENFORCEE', 'Acoustique renforcée', 'Prestaterre', {
        sources: [p('14'), p('100-103', ' (annexe 2)')],
        applicability: [notIndividual('Logements collectifs ; non applicable à la maison individuelle (p. 14).')],
        criteria: { type: 'all', items: [any('Un niveau parmi 4.3.4 (55), 4.3.5 (52), 4.3.6 (50)', ['4.3.4', '4.3.5', '4.3.6'])] }
      }),
      m('ECONOMIE_CIRCULAIRE', 'Économie circulaire', 'Prestaterre', {
        sources: [p('14'), p('99', ' (légende)'), p('100-103', ' (annexe 2)')],
        applicability: [regime('RE2020', 'RE 2020 uniquement (p. 14).')],
        criteria: { type: 'all', items: [
          req('1.1.2', { when: { field: 'ln2026.concerne.1.1.2' }, label: '1.1.2 Diagnostic PEMD (si concerné)' }),
          req('1.1.6'),
          req('1.1.7', { when: { field: 'ln2026.demolition' }, label: '1.1.7 Diagnostic ressources (en cas de démolition préalable)' }),
          req('1.2.4'), req('1.2.5'), req('1.2.6'), req('2.3.1'), req('2.3.2'), req('2.3.3'),
          req('3.3.15', { inferredAlt: ['3.3.16', '3.3.17', '3.3.18'], label: '3.3.15 IC Construction 2025 réglementaire (niveau minimal)' }),
          req('3.5.1'),
          req('3.5.2', { when: { field: 'ln2026.demolition' }, label: '3.5.2 Valorisation des déchets de démolition (si concerné)' }),
          req('3.5.4'), req('3.5.5', { inferredAlt: ['3.5.6'] }), req('3.6.10'), req('4.2.1'), req('4.6.3'), req('4.7.4')
        ] },
        optional: ['1.1.5', '1.1.8', '2.4.7', '3.3.17', '3.3.18', '3.4.2', '3.5.6', '3.6.8', '4.1.3', '4.1.4', '4.7.1', '4.7.3'],
        prerequisites: [ext('Un niveau IC plus élevé peut remplacer le minimum 3.3.15 lorsque les règles le permettent (légende p. 99) : remplacement affiché « à vérifier ».')]
      }),
      ...['ATTENUATION', 'ADAPTATION'].map(obj => m(`TAXINOMIE_${obj}`, `Taxinomie européenne — ${obj === 'ATTENUATION' ? 'Atténuation' : 'Adaptation'}`, 'Prestaterre', {
        officialName: 'Taxinomie européenne',
        sources: [p('14-15'), p('100-103', ' (annexe 2)')],
        criteria: { type: 'all', items: [
          req('1.1.1', { when: { field: 'ln2026.taxoArticle', applicableIf: ['7.1'] } }),
          req('1.1.8', { when: { field: 'ln2026.taxoArticle', applicableIf: ['7.1'] } }),
          req('1.1.9'),
          obj === 'ATTENUATION'
            ? req('2.3.1', { when: { field: 'ln2026.taxoArticle', applicableIf: ['7.1'] } })
            : { type: 'switch', field: 'ln2026.taxoArticle', label: '2.3.1 Charte chantier à faibles nuisances', cases: { '7.1': req('2.3.1'), '7.7': { type: 'unknown', label: '2.3.1 (article 7.7)', reason: 'p. 15 retire l’obligation, le tableau p. 101 porte X (ambiguïté G)' } } },
          regimeSwitch('Voie énergétique',
            { type: 'unknown', label: 'Voie RT 2012', reason: `Le tableau porte X sur ${obj === 'ATTENUATION' ? '3.1.2 et 3.2.1' : '3.1.1'} sans décomposition logique complète des voies énergétiques` },
            req('3.3.1')),
          req('3.5.3', { when: { field: 'ln2026.taxoArticle', applicableIf: ['7.1'] } }),
          req('4.1.2', { when: { field: 'ln2026.taxoArticle', applicableIf: ['7.1'] } }),
          req('4.4.1', { when: { field: 'ln2026.taxoArticle', applicableIf: ['7.1'] } })
        ] },
        prerequisites: [
          ext('Choisir l’objectif Atténuation OU Adaptation (p. 14) ; distinguer article 7.1 et article 7.7 (VEFA ou maîtrise d’ouvrage directe destinée à la location : 7.7).'),
          ext('Règlement délégué (UE) 2021/2139 (critères techniques, absence de préjudice important), appendice C, arrêté du 28/05/2009 (produits CMR) : règles externes non vérifiables ici.')
        ],
        ambiguities: obj === 'ADAPTATION' ? [{ id: 'G', affectsScore: false, text: 'Adaptation 7.7 : p. 15 retire l’obligation 2.3.1, le tableau p. 101 lui porte X ; la ligne reste indéterminée en 7.7.' }] : []
      })),
      m('HORIZON_ZERO_CARBONE', 'Horizon Zéro Carbone', 'Prestaterre', {
        sources: [p('15-16'), p('100-103', ' (annexe 2)')],
        applicability: [regime('RE2020', 'RE 2020 uniquement (p. 15).'), notIndividual('Non applicable à la maison individuelle (p. 15).'), { field: 'ln2026.sdp500', in: ['oui'], text: 'Construction neuve de plus de 500 m² SDP en France, incorporant des matériaux biosourcés (p. 15).' }],
        criteria: { type: 'all', items: [
          any('Un niveau BBCA RE 2020 : 3.3.22, 3.3.23 ou 3.3.24', ['3.3.22', '3.3.23', '3.3.24']),
          { type: 'unknown', label: 'Niveaux IC 3.3.12 à 3.3.18 selon la date de PC ou le niveau désiré', reason: 'Arbre de décision non fourni par le référentiel (ambiguïté H)' },
          req('3.6.9'), req('3.6.11'), req('3.6.12')
        ] },
        optional: ['1.1.8', '1.1.9', '2.1.1', '2.2.2', '2.4.3', '2.4.7', '3.4.1', '3.4.2', '3.5.2', '3.5.3', '4.1.3', '4.1.4', '4.3.1', '4.3.4', '4.4.1', '4.6.1', '4.6.2', '4.7.3', '4.8.4', '4.9.5'],
        prerequisites: [ext('Méthode du label d’État bas carbone « bâtiment neuf biosourcé » : conformité extérieure non démontrée par les codes.')],
        ambiguities: [{ id: 'I', affectsScore: false, text: '4.9.4 cité en co-bénéfice optionnel p. 16 mais non marqué O dans l’annexe p. 103.' }]
      }),
      m('BIODIVERSITE', 'Biodiversité', 'Prestaterre', {
        sources: [p('16-17'), p('100-103', ' (annexe 2)')],
        criteria: { type: 'all', items: ['1.1.1', '2.1.1', '2.1.2', '2.1.3', '2.2.2', '2.4.1', '2.4.2', '2.4.3', '2.4.6', '2.4.7'].map(c => req(c)) }
      }),
      m('HABITAT_SENIOR', 'Habitat sénior et autonomie', 'Prestaterre', {
        sources: [p('17'), p('100-103', ' (annexe 2)')],
        criteria: { type: 'all', items: ['2.4.5', '4.1.2', '4.3.1', '4.3.3', '4.3.4', '4.4.1', '4.4.8', '4.5.1', '4.5.3', '4.5.4', '4.8.2', '4.8.3', '4.8.5', '4.8.9', '4.8.10', '4.9.4', '4.9.5', '4.9.6', '4.10.2', '4.10.3', '4.10.6', '4.10.7', '4.10.8'].map(c => req(c)) }
      }),
      m('BONUS_CONSTRUCTIBILITE', 'Bonus de constructibilité', 'Prestaterre', {
        sources: [p('17-18'), p('100-103', ' (annexe 2)')],
        criteria: { type: 'all', items: [{ type: 'any', label: 'Une voie parmi A, B ou C', items: [
          any('Voie A : au moins E3/C1 (3.2.3, 3.2.4, 3.2.7 ou 3.2.8)', ['3.2.3', '3.2.4', '3.2.7', '3.2.8']),
          { type: 'all', label: 'Voie B : 3.3.3 et 3.3.6 et 3.3.9 et IC Énergie (3.3.14 si PC ≥ 2025, sinon 3.3.13)', items: [req('3.3.3'), req('3.3.6'), req('3.3.9'), pcSwitch('IC Énergie', req('3.3.13'), req('3.3.14'))] },
          pcSwitch('Voie C : IC Construction (3.3.17 si PC ≥ 2025, sinon 3.3.16)', req('3.3.16', { ambiguity: 'F' }), req('3.3.17'))
        ] }] },
        prerequisites: [ext('Arrêtés du 12/10/2016 et du 08/03/2023 et dispositions du code de l’urbanisme citées (p. 18).')],
        ambiguities: [{ id: 'F', affectsScore: false, text: 'Voie C : p. 18 inclut 3.3.16 pour les PC antérieurs à 2025, le tableau n’affiche C que sur 3.3.17 ; la voie narrative est conservée.' }]
      }),
      m('LABEL_BBCA', 'Label Bâtiment Bas Carbone (BBCA)', 'Partenaire', {
        sources: [p('11'), p('18'), p('48-49'), p('57-58')],
        ...alone,
        applicability: [notIndividual('Non applicable au résidentiel individuel isolé et groupé (p. 18).')],
        criteria: { type: 'all', items: [
          regimeSwitch('Niveau BBCA', any('RT 2012 : 3.2.9, 3.2.10 ou 3.2.11', ['3.2.9', '3.2.10', '3.2.11']), any('RE 2020 : 3.3.22, 3.3.23 ou 3.3.24', ['3.3.22', '3.3.23', '3.3.24'])),
          regimeSwitch('Prérequis énergétique (p. 11)', any('RT 2012 : 3.1.2, 3.1.3 ou 3.1.4', ['3.1.2', '3.1.3', '3.1.4']), any('RE 2020 : un code parmi 3.3.12 à 3.3.18', range('3.3', 12, 18)))
        ] },
        prerequisites: [ext('Référentiel technique BBCA (association BBCA) non fourni : sa validation ne se déduit pas des codes.')]
      }),
      m('BBCA_CONTRIBUTION_NEUTRALITE', 'Label BBCA option Contribution Neutralité', 'Partenaire', {
        sources: [p('18'), p('58-59')],
        ...alone,
        applicability: [regime('RE2020', 'RE 2020 uniquement (p. 18).'), notIndividual('Non applicable au résidentiel individuel isolé et groupé (p. 18).')],
        criteria: { type: 'all', items: [
          { type: 'mention', id: 'BEE_LN_2026_LABEL_BBCA' },
          { type: 'any', label: 'Un niveau de contribution avec son niveau BBCA minimal', items: [
            { type: 'all', label: '3.3.25 (1 étoile) avec BBCA Standard au moins', items: [req('3.3.25'), any('BBCA ≥ Standard', ['3.3.22', '3.3.23', '3.3.24'])] },
            { type: 'all', label: '3.3.26 (2 étoiles) avec BBCA Performance au moins', items: [req('3.3.26'), any('BBCA ≥ Performance', ['3.3.23', '3.3.24'])] },
            { type: 'all', label: '3.3.27 (3 étoiles) avec BBCA Excellence', items: [req('3.3.27'), req('3.3.24')] },
            { type: 'all', label: '3.3.28 (4 étoiles) avec BBCA Excellence', items: [req('3.3.28'), req('3.3.24')] }
          ] }
        ] },
        dependencies: ['BEE_LN_2026_LABEL_BBCA'],
        prerequisites: [ext('Seuils physiques de contribution (part de l’impact carbone évitée ou séquestrée) non calculés à partir des codes (ambiguïté L).')]
      }),
      m('BIOSOURCE_2024', 'Label Bâtiment Biosourcé 2024', 'Partenaire', {
        sources: [p('12'), p('18-19'), p('65-66')],
        ...alone,
        applicability: [regime('RE2020', 'RE 2020 uniquement (p. 18).')],
        criteria: { type: 'all', items: [
          any('Un niveau 2024 : 3.6.4, 3.6.5 ou 3.6.6', ['3.6.4', '3.6.5', '3.6.6']),
          any('Au moins une exigence parmi 3.3.1 à 3.3.19', range('3.3', 1, 19))
        ] },
        prerequisites: [ext('Arrêté du 02/07/2024 ; forêt gérée durablement, étiquette A si concerné, justification du carbone biogénique, contrôles conception/exécution (p. 18-19). Les niveaux Biosourcé 2013 (3.6.1 à 3.6.3) ne remplacent pas les niveaux 2024.')]
      }),
      m('LABEL_E_C', 'Label Énergie positive et Réduction Carbone (E+C-)', 'Partenaire', {
        sources: [p('19')],
        ...alone,
        applicability: [regime('RT2012', 'RT 2012 uniquement (p. 19).')],
        criteria: { type: 'all', items: [any('Un des huit niveaux 3.2.1 à 3.2.8', range('3.2', 1, 8))] },
        prerequisites: [ext('Référentiels externes « Énergie-Carbone » (niveaux et méthode) non fournis.')]
      }),
      m('EFFINERGIE_PLUS', 'Label Effinergie+', 'Partenaire', {
        sources: [p('19'), p('100-103', ' (annexe 2)')],
        applicability: [regime('RT2012', 'RT 2012 uniquement (p. 19).')],
        criteria: { type: 'all', items: ['1.1.5', '3.1.5', '4.3.1', '4.3.2', '4.4.1', '4.4.3', '4.6.1'].map(c => req(c)) },
        recommended: ['1.1.3', '1.1.4', '4.3.4', '4.3.5', '4.3.6', '4.5.1'],
        prerequisites: [effinergieExt]
      }),
      m('BEPOS_EFFINERGIE_2013', 'Label BEPOS Effinergie 2013', 'Partenaire', {
        sources: [p('19'), p('100-103', ' (annexe 2)')],
        applicability: [regime('RT2012', 'RT 2012 uniquement (p. 19).')],
        criteria: { type: 'all', items: ['1.1.3', '1.1.5', '3.1.6', '4.3.1', '4.3.2', '4.4.1', '4.4.3', '4.6.1'].map(c => req(c)) },
        recommended: ['1.1.4', '4.3.4', '4.3.5', '4.3.6', '4.5.1'],
        prerequisites: [effinergieExt]
      }),
      m('BBC_EFFINERGIE_2017', 'Label BBC Effinergie 2017', 'Partenaire', {
        sources: [p('20'), p('49'), p('100-103', ' (annexe 2)')],
        applicability: [regime('RT2012', 'RT 2012 uniquement (p. 20).')],
        criteria: { type: 'all', items: [req('1.1.5'), req('3.2.12'), any('Niveau E+C- au moins E2/C1 (3.2.2, 3.2.3, 3.2.4, 3.2.6, 3.2.7, 3.2.8)', ['3.2.2', '3.2.3', '3.2.4', '3.2.6', '3.2.7', '3.2.8']), req('4.4.3'), req('4.6.1')] },
        recommended: ['1.1.4', '4.3.1', '4.3.2', '4.3.4', '4.3.5', '4.3.6', '4.4.1', '4.5.1'],
        prerequisites: [effinergieExt, ext('3.2.12 porte 0 point ; les points sont ceux du niveau E+C- retenu (p. 49).')]
      }),
      m('BEPOS_EFFINERGIE_2017', 'Label BEPOS Effinergie 2017', 'Partenaire', {
        sources: [p('20'), p('50'), p('100-103', ' (annexe 2)')],
        applicability: [regime('RT2012', 'RT 2012 uniquement (p. 20).')],
        criteria: { type: 'all', items: [req('1.1.5'), req('3.2.13'), any('Niveau E+C- au moins E3/C1 (3.2.3, 3.2.4, 3.2.7, 3.2.8)', ['3.2.3', '3.2.4', '3.2.7', '3.2.8']), req('4.4.3'), req('4.6.1')] },
        recommended: ['1.1.4', '4.3.1', '4.3.2', '4.3.4', '4.3.5', '4.3.6', '4.4.1', '4.5.1'],
        prerequisites: [effinergieExt, ext('3.2.13 porte 0 point ; les points sont ceux du niveau E+C- retenu (p. 50).')]
      }),
      m('BEPOS_PLUS_EFFINERGIE_2017', 'Label BEPOS+ Effinergie 2017', 'Partenaire', {
        sources: [p('20'), p('50'), p('100-103', ' (annexe 2)')],
        applicability: [regime('RT2012', 'RT 2012 uniquement (p. 20).')],
        criteria: { type: 'all', items: [req('1.1.5'), req('3.2.14'), any('Niveau E+C- au moins E4/C1 (3.2.4 ou 3.2.8)', ['3.2.4', '3.2.8']), req('4.4.3'), req('4.6.1')] },
        recommended: ['1.1.4', '4.3.1', '4.3.2', '4.3.4', '4.3.5', '4.3.6', '4.4.1', '4.5.1'],
        prerequisites: [effinergieExt, ext('3.2.14 porte 0 point ; les points sont ceux du niveau E+C- retenu (p. 50).')]
      }),
      m('EFFINERGIE_RE2020', 'Label Effinergie RE 2020 (dont option BEPOS)', 'Partenaire', {
        sources: [p('20'), p('54'), p('57'), p('100-103', ' (annexe 2)')],
        applicability: [regime('RE2020', 'RE 2020 uniquement (p. 20).')],
        criteria: { type: 'all', items: [
          req('1.1.5'), req('3.3.6'), req('3.3.10'),
          pcSwitch('IC Énergie (3.3.13, PC antérieur à 2025)', req('3.3.13', { inferredAlt: ['3.3.14'] }), { type: 'unknown', label: '3.3.13 pour un PC à compter de 2025', reason: '3.3.13 ne s’applique qu’aux PC antérieurs au 01/01/2025 ; règle non fixée pour les PC ultérieurs (ambiguïté J)' }),
          req('3.3.17'), req('3.3.20', { inferredAlt: ['3.3.21'] })
        ] },
        recommended: ['1.1.4', '4.3.1', '4.3.2', '4.3.4', '4.3.5', '4.3.6', '4.4.1', '4.5.1', '4.6.1'],
        prerequisites: [effinergieExt, ext('3.3.21 = option BEPOS du label (sous-option, p. 57).')]
      })
    ];
  }

  const catalog = {
    schemaVersion: 1,
    generatedFor: 'Observatoire Prestaterre V6.14',
    families: {
      BEE_LN: 'BEE Logement Neuf',
      BEE_LR: 'BEE Logement Rénovation',
      BEE_TN: 'BEE Tertiaire Neuf',
      BEE_TE: 'BEE Tertiaire Exploitation'
    },
    // Un « contexte normatif » = famille de référentiel + version datée. Les codes ne se comparent qu'à l'intérieur d'un contexte.
    sources: [
      {
        context: LR2025, family: 'BEE_LR', version: '2025-06-18', versionLabel: '18/06/2025', ref: 'REF AN 010-3',
        title: 'BEE Logement Rénovation', status: 'available', file: 'REF_AN_010-3_BEE_Logement_Rénovation_-_Version_du_18-06-2025.pdf', pages: 73,
        mentionPages: '10-13', annexPages: '67-72',
        pointThresholds: {
          text: 'Seuil minimum de points (p. 10) : rénovation lourde (coût des travaux ≥ 25 % de la valeur conventionnelle du bâtiment hors foncier) 80 points en maisons individuelles diffuses ou groupées, 100 points en logements collectifs ; rénovation légère (< 25 %) 40 et 60 points. Au moins une exigence sur la performance énergétique.',
          pages: '10'
        },
        certificationPrerequisites: [{ text: 'Pour toute certification BEE Logement Rénovation, l’exigence 3.1.1 « Isolation thermique minimale » doit être choisie a minima.', pages: '9' }],
        contextFields: [
          { id: 'lr2025.buildingType', label: 'Type d’ouvrage', values: [['collectif', 'Logements collectifs'], ['individuel', 'Résidentiel individuel (isolé ou groupé)']] },
          concerned('1.1.2', 'Diagnostic PEMD'),
          concerned('3.4.2', 'Valorisation des déchets de démolition'),
          concerned('4.1.1', 'Compteur général d’eau'),
          concerned('4.1.3', 'Qualité des équipements de robinetterie'),
          concerned('4.3.6', 'Coefficient d’absorption des circulations communes'),
          concerned('4.4.1', 'Produits peu émissifs'),
          concerned('4.4.3', 'Ventilation')
        ],
        requirements: [
      {"code": "1.1.1", "title": "Analyse de site", "points": 20},
      {"code": "1.1.2", "title": "Diagnostic Produits, Équipements, Matériaux et Déchets (PEMD)", "points": 20},
      {"code": "1.1.3", "title": "Évaluation de l'énergie grise des matériaux", "points": 20},
      {"code": "1.1.4", "title": "Simulation thermique dynamique", "points": 20},
      {"code": "1.1.5", "title": "Potentiel d’éco-mobilité", "points": 5},
      {"code": "1.1.6", "title": "Acoustique extérieure avant travaux", "points": 10},
      {"code": "1.1.7", "title": "Acoustique extérieure - Isolement de façade", "points": 10},
      {"code": "1.1.8", "title": "Diagnostic ressources, réemploi et réutilisation", "points": 30},
      {"code": "1.1.9", "title": "Dispositions prises pour l’évolutivité du bâtiment", "points": 30},
      {"code": "1.1.10", "title": "Analyse des risques climatiques sur le bâtiment", "points": 20},
      {"code": "1.2.1", "title": "Désignation d’un référent environnemental", "points": 15},
      {"code": "1.2.2", "title": "Cahier des charges environnemental", "points": 15},
      {"code": "1.2.3", "title": "Suivi du volet environnemental du projet", "points": 15},
      {"code": "1.2.4", "title": "Désignation d'un référent Économie circulaire", "points": 15},
      {"code": "1.2.5", "title": "Cahier des charges Économie circulaire", "points": 15},
      {"code": "1.2.6", "title": "Suivi du volet Economie circulaire", "points": 15},
      {"code": "2.1.1", "title": "Calcul de l’albédo moyen de la parcelle en fin d’opération", "points": 10},
      {"code": "2.1.2", "title": "Limitation des îlots de chaleur par la végétalisation du site", "points": 20},
      {"code": "2.2.1", "title": "Charte Chantier à faibles nuisances", "points": 30},
      {"code": "2.2.2", "title": "Mission de suivi Chantier à faibles nuisances", "points": 20},
      {"code": "2.2.3", "title": "Bilan Chantier à faibles nuisances", "points": 15},
      {"code": "2.3.1", "title": "Coefficient de Biotope par Surface", "points": 15},
      {"code": "2.3.2", "title": "Mise en place d’habitats semi-naturels", "points": 20},
      {"code": "2.3.3", "title": "Création et animation d’espaces partagés en faveur de la biodiversité", "points": 20},
      {"code": "2.3.4", "title": "Gestion durable de la végétalisation du site", "points": 20},
      {"code": "3.1.1", "title": "Isolation thermique minimale", "points": 0},
      {"code": "3.1.2", "title": "Niveau 150 - Niveau Haute Performance Énergétique HPE", "points": 10},
      {"code": "3.1.3", "title": "Niveau 80 - Niveau Bâtiment Basse Consommation BBC", "points": 40},
      {"code": "3.1.4", "title": "Niveau Passif", "points": 40},
      {"code": "3.1.5", "title": "Gain 30%", "points": 10},
      {"code": "3.1.6", "title": "Gain 35%", "points": 10},
      {"code": "3.1.7", "title": "Gain 40%", "points": 15},
      {"code": "3.1.8", "title": "Gain 50 %", "points": 20},
      {"code": "3.1.9", "title": "Gain 60 %", "points": 25},
      {"code": "3.1.10", "title": "Niveau BBC Effinergie Rénovation 2024 - Première étape", "points": 30},
      {"code": "3.1.11", "title": "Niveau BBC Effinergie Rénovation 2024", "points": 50},
      {"code": "3.2.1", "title": "Étiquette DPE Bâtiment Niveau C", "points": 15},
      {"code": "3.2.2", "title": "Étiquette DPE Bâtiment Niveau B", "points": 20},
      {"code": "3.2.3", "title": "Étiquette DPE Bâtiment Niveau A", "points": 30},
      {"code": "3.2.4", "title": "Réduction des émissions de GES - Étiquette DPE GES niveau C", "points": 20},
      {"code": "3.2.5", "title": "Réduction des émissions de GES - Étiquette DPE GES niveau B", "points": 30},
      {"code": "3.2.6", "title": "Réduction des émissions de GES - Étiquette DPE GES niveau A", "points": 40},
      {"code": "3.2.7", "title": "Niveau BBCA Standard", "points": 30},
      {"code": "3.2.8", "title": "Niveau BBCA Performance", "points": 40},
      {"code": "3.2.9", "title": "Niveau BBCA Excellence", "points": 50},
      {"code": "3.3.1", "title": "Utilisation des énergies renouvelables", "points": 30},
      {"code": "3.3.2", "title": "Raccordement à un réseau de chaleur et/ou de froid", "points": 25},
      {"code": "3.4.1", "title": "Valorisation des déchets générés par le chantier", "points": 20},
      {"code": "3.4.2", "title": "Valorisation des déchets de démolition", "points": 20},
      {"code": "3.4.3", "title": "Valorisation des déchets - Taxinomie compatible", "points": 20},
      {"code": "3.4.4", "title": "Gestion des terres excavées", "points": 20},
      {"code": "3.4.5", "title": "Réemploi et réutilisation des produits, équipements et matériaux (PEM) - Niveau 1", "points": 20},
      {"code": "3.4.6", "title": "Réemploi et réutilisation des produits, équipements et matériaux (PEM) - Niveau 2", "points": 30},
      {"code": "3.5.1", "title": "Utilisation de produits biosourcés", "points": 20},
      {"code": "3.5.2", "title": "Qualité et performance des produits", "points": 20},
      {"code": "3.5.3", "title": "Produits de construction issus de bois certifié français", "points": 30},
      {"code": "3.5.4", "title": "Produits de construction issus de matériaux recyclés", "points": 15},
      {"code": "3.6.1", "title": "Comptage d’énergie par usage dans le logement", "points": 20},
      {"code": "3.6.2", "title": "Comptage d’énergie par usage dans le bâtiment", "points": 20},
      {"code": "3.7.1", "title": "Commissionnement des installations techniques", "points": 20},
      {"code": "4.1.1", "title": "Compteur général d’eau par bâtiment et par type d’usage", "points": 15},
      {"code": "4.1.2", "title": "Équipements individuels économes en eau", "points": 5},
      {"code": "4.1.3", "title": "Qualité des équipements de robinetterie", "points": 5},
      {"code": "4.1.4", "title": "Récupération des eaux pluviales pour un usage extérieur", "points": 20},
      {"code": "4.1.5", "title": "Récupération des eaux pluviales pour un usage intérieur", "points": 20},
      {"code": "4.2.1", "title": "Traitement collectif des déchets ménagers", "points": 20},
      {"code": "4.3.1", "title": "Confort thermique - Limitation des températures estivales", "points": 20},
      {"code": "4.3.2", "title": "Confort visuel - Analyse Points forts / Points faibles", "points": 10},
      {"code": "4.3.3", "title": "Confort visuel - Analyse Facteur de Lumière du Jour FLJ", "points": 15},
      {"code": "4.3.4", "title": "Confort acoustique - Bruits et chocs entre logements", "points": 30},
      {"code": "4.3.5", "title": "Confort acoustique - Bruits et chocs entre logements et circulations", "points": 20},
      {"code": "4.3.6", "title": "Confort acoustique - Coefficient d'absorption dans les circulations communes Niveau 1", "points": 15},
      {"code": "4.3.7", "title": "Confort acoustique - Coefficient d'absorption dans les circulations communes Niveau 2", "points": 20},
      {"code": "4.3.8", "title": "Confort acoustique - Acoustique extérieure après travaux (mesures)", "points": 10},
      {"code": "4.4.1", "title": "Qualité de l’air intérieur - Produits peu émissifs", "points": 20},
      {"code": "4.4.2", "title": "Qualité de l’air intérieur - Produits peu émissifs certifiés", "points": 25},
      {"code": "4.4.3", "title": "Qualité de l’air intérieur - Ventilation", "points": 15},
      {"code": "4.4.4", "title": "Qualité de l’air intérieur - Mesure", "points": 20},
      {"code": "4.4.5", "title": "Exposition aux champs électriques - Installation de câbles ou fils blindés", "points": 10},
      {"code": "4.5.1", "title": "Gestion automatisée et communicante du logement", "points": 30},
      {"code": "4.5.2", "title": "Pilotage des veilles", "points": 10},
      {"code": "4.5.3", "title": "Coupure générale de l'éclairage", "points": 10},
      {"code": "4.6.1", "title": "Sensibilisation et information des occupants", "points": 20},
      {"code": "4.6.2", "title": "Accompagnement et suivi des occupants", "points": 25},
      {"code": "4.6.3", "title": "Information des habitants sur les équipements existants pour le traitement des déchets", "points": 5},
      {"code": "4.7.1", "title": "Mise en place d’espaces partagés", "points": 25},
      {"code": "4.7.2", "title": "Mise à disposition de moyens de déplacement partagés", "points": 25},
      {"code": "4.7.3", "title": "Incitation au réemploi, à la réparation et à la réutilisation", "points": 10},
      {"code": "4.8.1", "title": "Aménagement des cheminements piétons", "points": 5},
      {"code": "4.8.2", "title": "Éclairage des cheminements extérieurs", "points": 10},
      {"code": "4.8.3", "title": "Éclairement des parties communes", "points": 20},
      {"code": "4.8.4", "title": "Local à vélo sécurisé", "points": 15},
      {"code": "4.8.5", "title": "Bornes pour vélos électriques", "points": 15},
      {"code": "4.8.6", "title": "Bornes pour véhicules électriques", "points": 20},
      {"code": "4.9.1", "title": "Gestion multidimensionnelle du projet", "points": 5},
      {"code": "4.9.2", "title": "Aménagement du logement", "points": 20},
      {"code": "4.9.3", "title": "Services aux occupants", "points": 20}
        ]
      },
      {
        context: 'BEE_LN@2026-05-04', family: 'BEE_LN', version: '2026-05-04', versionLabel: '04/05/2026', ref: 'REF AN 010-1',
        title: 'BEE Logement Neuf', status: 'available', file: 'REF_AN_010-1_BEE_Logement_Neuf_-_Version_du_04-05-2026.pdf', pages: 106,
        extraction: 'BEE_Logement_Neuf_2026_Mentions_pour_Claude.txt (dossier d’extraction transmis avec la demande ; le PDF lui-même n’a pas été transmis dans cette session)',
        mentionPages: '10-20', annexPages: '98-103',
        pointThresholds: { text: 'Certification de base : au moins 145 points ET au moins une exigence énergétique/énergie-carbone de la cible 3 du régime applicable (thèmes 3.1, 3.2 ou 3.3) ; respect de la réglementation (p. 11).', pages: '11' },
        certificationPrerequisites: [{ text: 'Périmètre : bâtiments neufs résidentiels individuels ou collectifs en France métropolitaine, RT 2012 ou RE 2020 selon le régime applicable (p. 10).', pages: '10' }],
        contextFields: [
          { id: 'ln2026.regime', label: 'Régime réglementaire', values: [['RT2012', 'RT 2012'], ['RE2020', 'RE 2020']] },
          { id: 'ln2026.buildingType', label: 'Type d’ouvrage', values: [['collectif', 'Logements collectifs'], ['individuel_isole', 'Maison individuelle isolée'], ['individuel_groupe', 'Maisons individuelles groupées']] },
          { id: 'ln2026.permit', label: 'Date de dépôt du permis de construire (et non date d’accord)', values: [['avant2024', 'Jusqu’au 31/12/2023'], ['2024', 'Du 01/01/2024 au 31/12/2024'], ['2025_2027', 'Du 01/01/2025 au 31/12/2027'], ['2028plus', 'À compter du 01/01/2028']] },
          { id: 'ln2026.taxoArticle', label: 'Taxinomie : article visé', values: [['7.1', 'Article 7.1'], ['7.7', 'Article 7.7 (acquisition VEFA ou détention destinée à la location)']] },
          { id: 'ln2026.concerne.1.1.2', label: '« 1.1.2 Diagnostic PEMD » est concerné', values: [['oui', 'Oui'], ['non', 'Non']] },
          { id: 'ln2026.demolition', label: 'Démolition préalable (1.1.7, 3.5.2)', values: [['oui', 'Oui'], ['non', 'Non']] },
          { id: 'ln2026.concerne.4.4.5', label: '« 4.4.5 Radon » est concerné', values: [['oui', 'Oui'], ['non', 'Non']] },
          { id: 'ln2026.sdp500', label: 'Plus de 500 m² SDP en France, avec matériaux biosourcés (Horizon Zéro Carbone)', values: [['oui', 'Oui'], ['non', 'Non']] }
        ],
        requirements: [
      {"code": "1.1.1", "title": "Analyse de site", "points": 20, "page": "100"},
      {"code": "1.1.2", "title": "Diagnostic Produits, Équipements, Matériaux et Déchets (PEMD)", "points": 20, "page": "100"},
      {"code": "1.1.3", "title": "Évaluation de l'énergie grise des matériaux", "points": 20, "page": "100"},
      {"code": "1.1.4", "title": "Simulation thermique dynamique", "points": 20, "page": "100"},
      {"code": "1.1.5", "title": "Potentiel d’éco-mobilité", "points": 5, "page": "100"},
      {"code": "1.1.6", "title": "Analyse d’opportunité Économie circulaire", "points": 20, "page": "100"},
      {"code": "1.1.7", "title": "Diagnostic ressources, réemploi et réutilisation", "points": 30, "page": "100"},
      {"code": "1.1.8", "title": "Dispositions prises pour l’évolutivité du bâtiment", "points": 30, "page": "100"},
      {"code": "1.1.9", "title": "Analyse des risques climatiques sur le bâtiment", "points": 20, "page": "100"},
      {"code": "1.1.10", "title": "Étude en coût global", "points": 30, "page": "100"},
      {"code": "1.2.1", "title": "Désignation d’un référent environnemental", "points": 15, "page": "100"},
      {"code": "1.2.2", "title": "Cahier des charges environnemental", "points": 15, "page": "100"},
      {"code": "1.2.3", "title": "Suivi du volet environnemental du projet", "points": 15, "page": "100"},
      {"code": "1.2.4", "title": "Désignation d'un référent Économie circulaire", "points": 15, "page": "100"},
      {"code": "1.2.5", "title": "Cahier des charges Économie circulaire", "points": 15, "page": "100"},
      {"code": "1.2.6", "title": "Suivi du volet Économie circulaire", "points": 15, "page": "100"},
      {"code": "2.1.1", "title": "Perméabilité de la parcelle", "points": 15, "page": "101"},
      {"code": "2.1.2", "title": "Captation des eaux pluviales en toiture végétalisée", "points": 25, "page": "101"},
      {"code": "2.1.3", "title": "Végétalisation des places de parking", "points": 15, "page": "101"},
      {"code": "2.1.4", "title": "Noues végétalisées", "points": 25, "page": "101"},
      {"code": "2.2.1", "title": "Calcul de l’albédo moyen de la parcelle en fin d’opération", "points": 10, "page": "101"},
      {"code": "2.2.2", "title": "Limitation des îlots de chaleur par la végétalisation du site", "points": 20, "page": "101"},
      {"code": "2.3.1", "title": "Charte Chantier à faibles nuisances", "points": 30, "page": "101"},
      {"code": "2.3.2", "title": "Mission de suivi Chantier à faibles nuisances", "points": 20, "page": "101"},
      {"code": "2.3.3", "title": "Bilan Chantier à faibles nuisances", "points": 15, "page": "101"},
      {"code": "2.4.1", "title": "Coefficient de Biotope par Surface", "points": 15, "page": "101"},
      {"code": "2.4.2", "title": "Coefficient de Biotope par Surface en toiture végétalisée", "points": 20, "page": "101"},
      {"code": "2.4.3", "title": "Mise en place d’habitats semi-naturels", "points": 20, "page": "101"},
      {"code": "2.4.4", "title": "Mise en place d’habitats semi-naturels en toiture végétalisée", "points": 20, "page": "101"},
      {"code": "2.4.5", "title": "Création et animation d’espaces partagés en faveur de la biodiversité", "points": 20, "page": "101"},
      {"code": "2.4.6", "title": "Protection de la faune", "points": 20, "page": "101"},
      {"code": "2.4.7", "title": "Gestion durable de la végétalisation du site", "points": 20, "page": "101"},
      {"code": "2.4.8", "title": "Gestion durable de la végétalisation en toiture terrasse", "points": 20, "page": "101"},
      {"code": "3.1.1", "title": "Niveau RT 2012", "points": 0, "page": "102"},
      {"code": "3.1.2", "title": "Niveau RT 2012 -10%", "points": 10, "page": "102"},
      {"code": "3.1.3", "title": "Niveau RT 2012 -20%", "points": 20, "page": "102"},
      {"code": "3.1.4", "title": "Niveau Passif RT 2012", "points": 30, "page": "102"},
      {"code": "3.1.5", "title": "Niveau Effinergie+", "points": 30, "page": "102"},
      {"code": "3.1.6", "title": "Niveau BEPOS Effinergie 2013", "points": 40, "page": "102"},
      {"code": "3.2.1", "title": "Niveau Énergie 1 - Carbone 1 (E1/C1)", "points": 25, "page": "102"},
      {"code": "3.2.2", "title": "Niveau Énergie 2 - Carbone 1 (E2/C1)", "points": 30, "page": "102"},
      {"code": "3.2.3", "title": "Niveau Énergie 3 - Carbone 1 (E3/C1)", "points": 45, "page": "102"},
      {"code": "3.2.4", "title": "Niveau Énergie 4 - Carbone 1 (E4/C1)", "points": 60, "page": "102"},
      {"code": "3.2.5", "title": "Niveau Énergie 1 - Carbone 2 (E1/C2)", "points": 45, "page": "102"},
      {"code": "3.2.6", "title": "Niveau Énergie 2 - Carbone 2 (E2/C2)", "points": 50, "page": "102"},
      {"code": "3.2.7", "title": "Niveau Énergie 3 - Carbone 2 (E3/C2)", "points": 60, "page": "102"},
      {"code": "3.2.8", "title": "Niveau Énergie 4 - Carbone 2 (E4/C2)", "points": 70, "page": "102"},
      {"code": "3.2.9", "title": "Niveau BBCA Standard RT 2012", "points": 25, "page": "102"},
      {"code": "3.2.10", "title": "Niveau BBCA Performance RT 2012", "points": 30, "page": "102"},
      {"code": "3.2.11", "title": "Niveau BBCA Excellence RT 2012", "points": 40, "page": "102"},
      {"code": "3.2.12", "title": "Niveau BBC Effinergie 2017", "points": 0, "page": "102"},
      {"code": "3.2.13", "title": "Niveau BEPOS Effinergie 2017", "points": 0, "page": "102"},
      {"code": "3.2.14", "title": "Niveau BEPOS+ Effinergie 2017", "points": 0, "page": "102"},
      {"code": "3.3.1", "title": "Niveau RE 2020", "points": 0, "page": "102"},
      {"code": "3.3.2", "title": "Niveau Cep RE 2020 -5%", "points": 15, "page": "102"},
      {"code": "3.3.3", "title": "Niveau Cep RE 2020 -10%", "points": 20, "page": "102"},
      {"code": "3.3.4", "title": "Niveau Cep RE 2020 -20%", "points": 25, "page": "102"},
      {"code": "3.3.5", "title": "Niveau Cep,nr RE 2020 -5%", "points": 10, "page": "102"},
      {"code": "3.3.6", "title": "Niveau Cep,nr RE 2020 -10%", "points": 15, "page": "102"},
      {"code": "3.3.7", "title": "Niveau Cep,nr RE 2020 -20%", "points": 20, "page": "102"},
      {"code": "3.3.8", "title": "Niveau Bbio RE 2020 -5%", "points": 10, "page": "102"},
      {"code": "3.3.9", "title": "Niveau Bbio RE 2020 -10%", "points": 15, "page": "102"},
      {"code": "3.3.10", "title": "Niveau Bbio RE 2020 -15%", "points": 15, "page": "102"},
      {"code": "3.3.11", "title": "Niveau Bbio RE 2020 -20%", "points": 20, "page": "102"},
      {"code": "3.3.12", "title": "Niveau IC Énergie 2025 réglementaire", "points": 0, "page": "102"},
      {"code": "3.3.13", "title": "Niveau IC Énergie 2025", "points": 30, "page": "102"},
      {"code": "3.3.14", "title": "Niveau IC Énergie 2028", "points": 40, "page": "102"},
      {"code": "3.3.15", "title": "Niveau IC Construction 2025 réglementaire", "points": 0, "page": "102"},
      {"code": "3.3.16", "title": "Niveau IC Construction 2025", "points": 30, "page": "102"},
      {"code": "3.3.17", "title": "Niveau IC Construction 2028", "points": 40, "page": "102"},
      {"code": "3.3.18", "title": "Niveau IC Construction 2031", "points": 60, "page": "102"},
      {"code": "3.3.19", "title": "Niveau Passif RE 2020", "points": 30, "page": "102"},
      {"code": "3.3.20", "title": "Niveau Effinergie RE 2020", "points": 0, "page": "102"},
      {"code": "3.3.21", "title": "Niveau Effinergie RE 2020 option BEPOS", "points": 30, "page": "102"},
      {"code": "3.3.22", "title": "Niveau BBCA Standard RE 2020", "points": 25, "page": "102"},
      {"code": "3.3.23", "title": "Niveau BBCA Performance RE 2020", "points": 30, "page": "102"},
      {"code": "3.3.24", "title": "Niveau BBCA Excellence RE 2020", "points": 40, "page": "102"},
      {"code": "3.3.25", "title": "Option Contribution Neutralité 1 étoile", "points": 15, "page": "102"},
      {"code": "3.3.26", "title": "Option Contribution Neutralité 2 étoiles", "points": 20, "page": "102"},
      {"code": "3.3.27", "title": "Option Contribution Neutralité 3 étoiles", "points": 25, "page": "102"},
      {"code": "3.3.28", "title": "Option Contribution Neutralité 4 étoiles", "points": 30, "page": "102"},
      {"code": "3.3.29", "title": "Performance renforcée", "points": 0, "page": "102"},
      {"code": "3.4.1", "title": "Utilisation des énergies renouvelables", "points": 30, "page": "102"},
      {"code": "3.4.2", "title": "Raccordement à un réseau de chaleur et/ou de froid", "points": 25, "page": "102"},
      {"code": "3.4.3", "title": "Chauffage basse consommation", "points": 20, "page": "102"},
      {"code": "3.5.1", "title": "Valorisation des déchets générés par le chantier", "points": 20, "page": "102"},
      {"code": "3.5.2", "title": "Valorisation des déchets de démolition", "points": 20, "page": "102"},
      {"code": "3.5.3", "title": "Valorisation des déchets - Taxinomie compatible", "points": 20, "page": "102"},
      {"code": "3.5.4", "title": "Gestion des terres excavées", "points": 20, "page": "102"},
      {"code": "3.5.5", "title": "Réemploi et réutilisation des produits, équipements et matériaux (PEM) - Niveau 1", "points": 20, "page": "102"},
      {"code": "3.5.6", "title": "Réemploi et réutilisation des produits, équipements et matériaux (PEM) - Niveau 2", "points": 30, "page": "102"},
      {"code": "3.6.1", "title": "Biosourcé 2013 - Niveau 1", "points": 20, "page": "102"},
      {"code": "3.6.2", "title": "Biosourcé 2013 - Niveau 2", "points": 25, "page": "102"},
      {"code": "3.6.3", "title": "Biosourcé 2013 - Niveau 3", "points": 30, "page": "102"},
      {"code": "3.6.4", "title": "Bâtiment biosourcé 1er niveau 2024", "points": 20, "page": "102"},
      {"code": "3.6.5", "title": "Bâtiment biosourcé 2ème niveau 2024", "points": 25, "page": "102"},
      {"code": "3.6.6", "title": "Bâtiment biosourcé 3ème niveau 2024", "points": 30, "page": "102"},
      {"code": "3.6.7", "title": "Qualité et performance des produits", "points": 20, "page": "102"},
      {"code": "3.6.8", "title": "Produits de construction issus de bois certifié français", "points": 30, "page": "102"},
      {"code": "3.6.9", "title": "Produits de construction issus d’une forêt gérée durablement", "points": 15, "page": "102"},
      {"code": "3.6.10", "title": "Produits de construction issus de matériaux recyclés", "points": 15, "page": "102"},
      {"code": "3.6.11", "title": "Impact environnemental et durabilité des produits bois et biosourcés", "points": 20, "page": "102"},
      {"code": "3.6.12", "title": "Calcul des émissions stockées générées", "points": 20, "page": "102"},
      {"code": "3.7.1", "title": "Évaluation des charges - Niveau +", "points": 15, "page": "102"},
      {"code": "3.7.2", "title": "Évaluation des charges - Niveau ++", "points": 20, "page": "102"},
      {"code": "3.7.3", "title": "Évaluation des charges - Niveau +++", "points": 25, "page": "102"},
      {"code": "3.8.1", "title": "Commissionnement des installations techniques", "points": 20, "page": "102"},
      {"code": "4.1.1", "title": "Compteurs d’eau par bâtiment et par type d’usage", "points": 15, "page": "103"},
      {"code": "4.1.2", "title": "Qualité des équipements de robinetterie", "points": 5, "page": "103"},
      {"code": "4.1.3", "title": "Récupération des eaux pluviales pour un usage extérieur", "points": 20, "page": "103"},
      {"code": "4.1.4", "title": "Récupération des eaux pluviales pour un usage intérieur", "points": 20, "page": "103"},
      {"code": "4.1.5", "title": "Récupération des eaux grises", "points": 30, "page": "103"},
      {"code": "4.2.1", "title": "Traitement collectif des déchets ménagers", "points": 20, "page": "103"},
      {"code": "4.3.1", "title": "Confort thermique - Limitation des températures estivales", "points": 20, "page": "103"},
      {"code": "4.3.2", "title": "Confort visuel - Analyse Points forts / Points faibles", "points": 10, "page": "103"},
      {"code": "4.3.3", "title": "Confort visuel - Analyse Facteur de Lumière du Jour FLJ", "points": 15, "page": "103"},
      {"code": "4.3.4", "title": "Confort acoustique - Bruits de choc entre logements - Acoustique renforcée niveau 55", "points": 30, "page": "103"},
      {"code": "4.3.5", "title": "Confort acoustique - Bruits de choc entre logements - Acoustique renforcée niveau 52", "points": 35, "page": "103"},
      {"code": "4.3.6", "title": "Confort acoustique - Bruits de choc entre logements - Acoustique renforcée niveau 50", "points": 40, "page": "103"},
      {"code": "4.3.7", "title": "Confort acoustique - Bruits de choc entre logements et circulations - Acoustique renforcée niveau 55", "points": 20, "page": "103"},
      {"code": "4.3.8", "title": "Confort acoustique - Coefficient d’absorption dans les circulations communes", "points": 15, "page": "103"},
      {"code": "4.3.9", "title": "Confort acoustique - Acoustique extérieure (MI isolée)", "points": 30, "page": "103"},
      {"code": "4.4.1", "title": "Qualité de l’air intérieur - Produits peu émissifs", "points": 20, "page": "103"},
      {"code": "4.4.2", "title": "Qualité de l’air intérieur - Produits peu émissifs certifiés", "points": 25, "page": "103"},
      {"code": "4.4.3", "title": "Qualité de l’air intérieur - Ventilation", "points": 15, "page": "103"},
      {"code": "4.4.4", "title": "Qualité de l’air intérieur - Mesure", "points": 20, "page": "103"},
      {"code": "4.4.5", "title": "Qualité de l'air intérieur - Analyse du risque Radon", "points": 25, "page": "103"},
      {"code": "4.4.6", "title": "Exposition aux champs électriques - Positionnement des tableaux électriques", "points": 5, "page": "103"},
      {"code": "4.4.7", "title": "Exposition aux champs électriques - Installation de câbles ou fils blindés", "points": 10, "page": "103"},
      {"code": "4.4.8", "title": "Détecteurs de CO2", "points": 10, "page": "103"},
      {"code": "4.5.1", "title": "Gestion automatisée et communicante du logement", "points": 30, "page": "103"},
      {"code": "4.5.2", "title": "Pilotage des veilles", "points": 10, "page": "103"},
      {"code": "4.5.3", "title": "Coupure générale de l'éclairage", "points": 10, "page": "103"},
      {"code": "4.5.4", "title": "Accès internet haut débit", "points": 5, "page": "103"},
      {"code": "4.6.1", "title": "Sensibilisation et information des occupants", "points": 20, "page": "103"},
      {"code": "4.6.2", "title": "Accompagnement et suivi des occupants", "points": 25, "page": "103"},
      {"code": "4.6.3", "title": "Information des habitants sur les équipements existants pour le traitement des déchets", "points": 5, "page": "103"},
      {"code": "4.7.1", "title": "Mise en place d’espaces partagés", "points": 25, "page": "103"},
      {"code": "4.7.2", "title": "Accessibilité et aménagement des espaces partagés", "points": 15, "page": "103"},
      {"code": "4.7.3", "title": "Mise à disposition de moyens de déplacement partagés", "points": 25, "page": "103"},
      {"code": "4.7.4", "title": "Incitation au réemploi, à la réparation et à la réutilisation", "points": 10, "page": "103"},
      {"code": "4.8.1", "title": "Proximité des modes doux", "points": 10, "page": "103"},
      {"code": "4.8.2", "title": "Aménagement de cheminements piétons", "points": 5, "page": "103"},
      {"code": "4.8.3", "title": "Éclairage des cheminements extérieurs", "points": 10, "page": "103"},
      {"code": "4.8.4", "title": "Éclairement des parties communes", "points": 20, "page": "103"},
      {"code": "4.8.5", "title": "Luminosité des parties communes", "points": 10, "page": "103"},
      {"code": "4.8.6", "title": "Local à vélo sécurisé", "points": 15, "page": "103"},
      {"code": "4.8.7", "title": "Bornes pour vélos électriques", "points": 15, "page": "103"},
      {"code": "4.8.8", "title": "Bornes pour véhicules électriques", "points": 20, "page": "103"},
      {"code": "4.8.9", "title": "Stationnement PMR", "points": 20, "page": "103"},
      {"code": "4.8.10", "title": "Accès au local poubelle", "points": 10, "page": "103"},
      {"code": "4.9.1", "title": "Limitation du nombre de logements par palier", "points": 15, "page": "103"},
      {"code": "4.9.2", "title": "Surfaces minimales des logements", "points": 30, "page": "103"},
      {"code": "4.9.3", "title": "Espaces de rangement", "points": 15, "page": "103"},
      {"code": "4.9.4", "title": "Connexion du logement avec l’extérieur", "points": 25, "page": "103"},
      {"code": "4.9.5", "title": "Mutabilité des logements", "points": 15, "page": "103"},
      {"code": "4.9.6", "title": "Prévention des risques d’intrusion", "points": 10, "page": "103"},
      {"code": "4.10.1", "title": "Gestion multidimensionnelle du projet", "points": 5, "page": "103"},
      {"code": "4.10.2", "title": "Localisation du site et aménagement de ses abords", "points": 10, "page": "103"},
      {"code": "4.10.3", "title": "Aménagement du logement", "points": 20, "page": "103"},
      {"code": "4.10.4", "title": "Services aux occupants", "points": 20, "page": "103"},
      {"code": "4.10.5", "title": "Habitat intergénérationnel", "points": 10, "page": "103"},
      {"code": "4.10.6", "title": "Pose de mains courantes et création d'espaces d'attente assis", "points": 15, "page": "103"},
      {"code": "4.10.7", "title": "Poignées de portes adaptées", "points": 15, "page": "103"},
      {"code": "4.10.8", "title": "Dispositif d’appel d'urgence", "points": 20, "page": "103"}
        ]
      },
      {
        context: 'BEE_LR@2026-05-04', family: 'BEE_LR', version: '2026-05-04', versionLabel: '04/05/2026', ref: 'REF AN 010-3',
        title: 'BEE Logement Rénovation', status: 'source_missing',
        missing: 'PDF « REF AN 010-3 BEE Logement Rénovation — version du 04/05/2026 » non fourni (seule la version du 18/06/2025 a été transmise). Les règles 2025 ne sont pas transposées.'
      },
      {
        context: 'BEE_TN@?', family: 'BEE_TN', version: '', versionLabel: 'version non communiquée', ref: '',
        title: 'BEE Tertiaire Neuf', status: 'source_missing',
        missing: 'Référentiel BEE Tertiaire Neuf non fourni (ni document ni version).'
      },
      {
        context: 'BEE_TE@?', family: 'BEE_TE', version: '', versionLabel: 'version non communiquée', ref: '',
        title: 'BEE Tertiaire Exploitation', status: 'source_missing',
        missing: 'Référentiel BEE Tertiaire Exploitation non fourni (ni document ni version) : sa numérotation propre n’a pas pu être vérifiée.'
      }
    ],

    mentions: [
      // ------------------------------------------------------------------ BEE Logement Rénovation 18/06/2025
      {
        id: 'BEE_LR_2025_BPE', context: LR2025, name: 'Bâtiment Performance Énergétique (BPE)', kind: 'Prestaterre',
        sources: [{ ...SRC_LR2025, pages: '10' }, { ...SRC_LR2025, pages: '67, 71' }],
        criteria: null,
        notComputableReason: 'Le référentiel liste des exigences « éligibles » (performance énergétique, annexe 2) sans exigence obligatoire ni nombre minimal : aucune liste de critères nécessaires n’est définie.',
        eligible: ['3.1.2', '3.1.3', '3.1.4', '3.1.5', '3.1.6', '3.1.7', '3.1.8', '3.1.9', '3.2.1', '3.2.2', '3.2.3'],
        optional: [], recommended: [],
        points: { required: false, text: 'Seuil minimum de points non applicable (p. 10, annexe 2 p. 67).' },
        cumulation: { cumulable: false, text: 'Ne peut être associée à aucune autre exigence ou mention (p. 10, annexe 2 p. 67).' },
        prerequisites: [], dependencies: [], applicability: [],
        verification: 'verified'
      },
      {
        id: 'BEE_LR_2025_BEE_PLUS', context: LR2025, name: 'BEE+', kind: 'Prestaterre',
        sources: [{ ...SRC_LR2025, pages: '10-11' }, { ...SRC_LR2025, pages: '69-72 (colonne BEE+, chiffres = critères)' }],
        criteria: { type: 'all', items: [
          { type: 'req', code: '1.2.1', group: 'Critère 1 · Éco-conception & management du projet' },
          { type: 'req', code: '1.2.2', group: 'Critère 1 · Éco-conception & management du projet' },
          { type: 'req', code: '1.2.3', group: 'Critère 1 · Éco-conception & management du projet' },
          { type: 'req', code: '2.2.1', group: 'Critère 2 · Le bâtiment dans son environnement' },
          { type: 'req', code: '3.1.1', group: 'Critère 3 · Sobriété et efficacité du bâtiment' },
          { type: 'req', code: '3.1.2', alt: ['3.1.3'], label: 'Niveau HPE a minima (3.1.2 ou 3.1.3)', group: 'Critère 3 · Sobriété et efficacité du bâtiment' },
          { type: 'req', code: '3.2.1', alt: ['3.2.2', '3.2.3'], label: 'Étiquette DPE C a minima (3.2.1, 3.2.2 ou 3.2.3)', group: 'Critère 3 · Sobriété et efficacité du bâtiment' },
          { type: 'req', code: '3.6.2', group: 'Critère 3 · Sobriété et efficacité du bâtiment' },
          { type: 'req', code: '4.1.1', when: { field: 'lr2025.concerne.4.1.1' }, group: 'Critère 4 · Usages & qualité de vie' },
          { type: 'req', code: '4.1.3', when: { field: 'lr2025.concerne.4.1.3' }, group: 'Critère 4 · Usages & qualité de vie' },
          { type: 'req', code: '4.3.6', alt: ['4.3.7'], label: 'Coefficient d’absorption Niveau 1 a minima (4.3.6 ou 4.3.7)', when: { field: 'lr2025.concerne.4.3.6' }, group: 'Critère 4 · Usages & qualité de vie' },
          { type: 'req', code: '4.4.1', alt: ['4.4.2'], label: 'Produits peu émissifs a minima (4.4.1 ou 4.4.2)', when: { field: 'lr2025.concerne.4.4.1' }, group: 'Critère 4 · Usages & qualité de vie' },
          { type: 'req', code: '4.4.3', when: { field: 'lr2025.concerne.4.4.3' }, group: 'Critère 4 · Usages & qualité de vie' },
          { type: 'req', code: '4.6.1', group: 'Critère 4 · Usages & qualité de vie' }
        ] },
        optional: [], recommended: [],
        points: { required: true, text: 'Le seuil minimum de points s’applique (annexe 2 p. 67).' },
        cumulation: { cumulable: true, text: 'Cumulable avec d’autres mentions (annexe 2 p. 67).' },
        prerequisites: [{ text: 'Les exigences 4.1.1, 4.1.3, 4.3.6, 4.4.1 et 4.4.3 ne sont obligatoires que si elles sont concernées par les travaux de rénovation (p. 11 ; cases jaunes « obligatoire en cas de travaux », annexe 2).', pages: '11, 72' }],
        dependencies: [], applicability: [],
        verification: 'verified'
      },
      {
        id: 'BEE_LR_2025_ECONOMIE_CIRCULAIRE', context: LR2025, name: 'Économie circulaire', kind: 'Prestaterre',
        sources: [{ ...SRC_LR2025, pages: '11-12' }, { ...SRC_LR2025, pages: '69-72 (colonne Économie circulaire)' }],
        criteria: { type: 'all', items: [
          { type: 'req', code: '1.1.2', when: { field: 'lr2025.concerne.1.1.2' } },
          { type: 'req', code: '1.1.8' },
          { type: 'req', code: '1.2.4' },
          { type: 'req', code: '1.2.5' },
          { type: 'req', code: '1.2.6' },
          { type: 'req', code: '2.2.1' },
          { type: 'req', code: '2.2.2' },
          { type: 'req', code: '2.2.3' },
          { type: 'req', code: '3.1.10', inferredAlt: ['3.1.11'] },
          { type: 'req', code: '3.4.1' },
          { type: 'req', code: '3.4.2', when: { field: 'lr2025.concerne.3.4.2' } },
          { type: 'req', code: '3.4.4' },
          { type: 'req', code: '3.4.5', inferredAlt: ['3.4.6'] },
          { type: 'req', code: '3.5.4' },
          { type: 'req', code: '4.1.2' },
          { type: 'req', code: '4.2.1' },
          { type: 'req', code: '4.6.3' },
          { type: 'req', code: '4.7.3' }
        ] },
        optional: ['1.1.3', '1.1.5', '1.1.9', '2.3.4', '3.1.11', '3.3.2', '3.4.6', '3.5.3', '4.1.4', '4.1.5', '4.7.1', '4.7.2'],
        recommended: [],
        points: { required: true, text: 'Le seuil minimum de points s’applique (annexe 2 p. 67).' },
        cumulation: { cumulable: true, text: 'Cumulable avec d’autres mentions (annexe 2 p. 67).' },
        prerequisites: [{ text: '1.1.2 et 3.4.2 sont obligatoires « si concerné » (p. 11). 3.1.11 et 3.4.6 (niveaux supérieurs) sont listés comme optionnels : le référentiel n’écrit pas qu’ils remplacent 3.1.10 et 3.4.5 ; ce remplacement reste « à vérifier ».', pages: '11' }],
        dependencies: [], applicability: [],
        verification: 'verified'
      },
      {
        id: 'BEE_LR_2025_TAXINOMIE_ATTENUATION', context: LR2025, name: 'Taxinomie européenne — objectif Atténuation', kind: 'Prestaterre',
        officialName: 'Taxinomie européenne',
        sources: [{ ...SRC_LR2025, pages: '12' }, { ...SRC_LR2025, pages: '69-72 (colonne Taxinomie européenne - Atténuation)' }],
        criteria: { type: 'all', items: [
          { type: 'req', code: '1.1.9' },
          { type: 'req', code: '1.1.10' },
          { type: 'req', code: '2.2.1' },
          { type: 'req', code: '3.1.2', inferredAlt: ['3.1.3', '3.1.4'] },
          { type: 'req', code: '3.4.3' },
          { type: 'req', code: '4.1.3' },
          { type: 'req', code: '4.4.1' }
        ] },
        optional: [], recommended: [],
        points: { required: true, text: 'Le seuil minimum de points s’applique (p. 12, annexe 2 p. 67).' },
        cumulation: { cumulable: true, text: 'Cumulable avec d’autres mentions (p. 12, annexe 2 p. 67).' },
        prerequisites: [
          { text: 'Choisir l’un des deux objectifs Climat (atténuation OU adaptation) et respecter toutes les exigences associées (p. 12). Les deux objectifs figurent ici comme deux entrées distinctes.', pages: '12' },
          { text: 'Respect du règlement délégué (UE) 2021/2139 du 04/06/2021 (critères d’examen technique et absence de préjudice important) — règle externe non fournie, non vérifiable ici.', pages: '12' },
          { text: 'Produits et matériaux conformes à l’appendice C du règlement délégué (UE) 2021/2139 et à l’arrêté du 28 mai 2009 (substances CMR) — règles externes non fournies.', pages: '12' }
        ],
        dependencies: [], applicability: [],
        verification: 'verified'
      },
      {
        id: 'BEE_LR_2025_TAXINOMIE_ADAPTATION', context: LR2025, name: 'Taxinomie européenne — objectif Adaptation', kind: 'Prestaterre',
        officialName: 'Taxinomie européenne',
        sources: [{ ...SRC_LR2025, pages: '12' }, { ...SRC_LR2025, pages: '69-72 (colonne Taxinomie européenne - Adaptation)' }],
        criteria: { type: 'all', items: [
          { type: 'req', code: '1.1.9' },
          { type: 'req', code: '1.1.10' },
          { type: 'req', code: '2.2.1' },
          { type: 'req', code: '3.4.3' },
          { type: 'req', code: '4.1.3' },
          { type: 'req', code: '4.4.1' }
        ] },
        optional: [], recommended: [],
        points: { required: true, text: 'Le seuil minimum de points s’applique (p. 12, annexe 2 p. 67).' },
        cumulation: { cumulable: true, text: 'Cumulable avec d’autres mentions (p. 12, annexe 2 p. 67).' },
        prerequisites: [
          { text: 'Choisir l’un des deux objectifs Climat (atténuation OU adaptation) et respecter toutes les exigences associées (p. 12).', pages: '12' },
          { text: 'Respect du règlement délégué (UE) 2021/2139 du 04/06/2021 et de l’arrêté du 28 mai 2009 — règles externes non fournies, non vérifiables ici.', pages: '12' }
        ],
        dependencies: [], applicability: [],
        verification: 'verified'
      },
      {
        id: 'BEE_LR_2025_LABEL_BBCA', context: LR2025, name: 'Label Bâtiment Bas Carbone (BBCA)', kind: 'Partenaire',
        sources: [{ ...SRC_LR2025, pages: '12' }, { ...SRC_LR2025, pages: '67, 71 (colonne Label BBCA)' }],
        criteria: { type: 'all', items: [
          { type: 'req', code: '3.2.7', alt: ['3.2.8', '3.2.9'], label: 'Une exigence du thème « Performance Énergie Carbone » BBCA (3.2.7, 3.2.8 ou 3.2.9)' }
        ] },
        optional: [], recommended: [],
        points: { required: 'conditional', text: 'Seuil de points non exigé si la mention est prise seule ; exigé si elle est cumulée (p. 10, annexe 2 p. 67).' },
        cumulation: { cumulable: 'conditional', text: 'Annexe 2 p. 67 : « Non (si seule) / Oui (si cumulée) ».' },
        prerequisites: [{ text: 'Mention partenaire : elle répond au référentiel technique de l’association BBCA, non fourni ; ses règles propres ne sont pas évaluées ici.', pages: '12' }],
        dependencies: [],
        applicability: [{ field: 'lr2025.buildingType', notIn: ['individuel'], text: 'Non applicable au résidentiel individuel (isolé et groupé) (p. 12).' }],
        verification: 'verified'
      },
      {
        id: 'BEE_LR_2025_BBC_RENO_2024_PE', context: LR2025, name: 'Label BBC Effinergie Rénovation 2024 — première étape', kind: 'Partenaire',
        sources: [{ ...SRC_LR2025, pages: '13' }, { ...SRC_LR2025, pages: '69-72 (colonne Label BBC Effinergie Rénovation 2024 - PE)' }],
        criteria: { type: 'all', items: [
          { type: 'req', code: '1.1.5' },
          { type: 'req', code: '3.1.10' },
          { type: 'req', code: '3.7.1' }
        ] },
        optional: [], recommended: ['2.3.1', '2.3.2', '2.3.3', '2.3.4'],
        points: { required: true, text: 'Le seuil minimum de points s’applique (annexe 2 p. 67).' },
        cumulation: { cumulable: true, text: 'Cumulable avec d’autres mentions (annexe 2 p. 67).' },
        prerequisites: [{ text: 'Exigences issues de l’arrêté du 3 octobre 2023 et des règles techniques de l’association Effinergie (non fournies) : elles ne sont pas évaluées ici.', pages: '13' }],
        dependencies: [], applicability: [],
        verification: 'verified'
      },
      {
        id: 'BEE_LR_2025_BBC_RENO_2024', context: LR2025, name: 'Label BBC Effinergie Rénovation 2024', kind: 'Partenaire',
        sources: [{ ...SRC_LR2025, pages: '13' }, { ...SRC_LR2025, pages: '69-72 (colonne Label BBC Effinergie Rénovation 2024)' }],
        criteria: { type: 'all', items: [
          { type: 'req', code: '1.1.5' },
          { type: 'req', code: '3.1.11' },
          { type: 'req', code: '3.7.1' }
        ] },
        optional: [], recommended: ['2.3.1', '2.3.2', '2.3.3', '2.3.4'],
        points: { required: true, text: 'Le seuil minimum de points s’applique (annexe 2 p. 67).' },
        cumulation: { cumulable: true, text: 'Cumulable avec d’autres mentions (annexe 2 p. 67).' },
        prerequisites: [{ text: 'Exigences issues de l’arrêté du 3 octobre 2023 et des règles techniques de l’association Effinergie (non fournies) : elles ne sont pas évaluées ici.', pages: '13' }],
        dependencies: [], applicability: [],
        verification: 'verified'
      },

      // ------------------------------------------------------------------ BEE Logement Neuf 04/05/2026
      ...lnMentions()
    ]
  };

  root.NEWOSB_MENTION_CATALOG = catalog;
  if (typeof module !== 'undefined' && module.exports) module.exports = catalog;
})(typeof window !== 'undefined' ? window : globalThis);
