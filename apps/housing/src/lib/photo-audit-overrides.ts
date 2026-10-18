import type { FurnitureTier, ModernityTier } from "@/types/housing";

export interface PhotoAuditOverride {
  modernityScore: number;
  modernityTier: ModernityTier;
  falseAC?: boolean;
  /** Split seen in the photos; confirms AC even when the listing text never mentions it. */
  verifiedAC?: boolean;
  falseGourmet?: boolean;
  falseFreeView?: boolean;
  /** Private balcony seen in the photos; grants the balcony bonus when the listing never mentions it. */
  verifiedBalcony?: boolean;
  /** No kitchen/wardrobe cabinets visible despite the portal checkboxes. */
  noCabinets?: boolean;
  /** Used only when the listing has no floor/floorRange. */
  floorHint?: "HIGH" | "MID" | "LOW";
  furnishedTier?: FurnitureTier;
  hasMaintenanceIssue?: boolean;
  hardExcludeDated?: boolean;
  visualWarnings?: string[];
}

export const PHOTO_AUDIT_OVERRIDES: Record<string, PhotoAuditOverride> = {
  "quintoandar:895706010": {
    "modernityScore": 56,
    "modernityTier": "STANDARD",
    "falseAC": true,
    "furnishedTier": "FULLY_FURNISHED",
    "hasMaintenanceIssue": false,
    "hardExcludeDated": true,
    "visualWarnings": [
      "Auditoria visual (Ed. Monet): piso com rejunte escuro, mobília datada de flat anos 90/2000 e sem ar-condicionado"
    ]
  },
  "quintoandar:895649428": {
    "modernityScore": 62,
    "modernityTier": "STANDARD",
    "falseAC": true,
    "furnishedTier": "FULLY_FURNISHED",
    "hasMaintenanceIssue": false,
    "hardExcludeDated": false,
    "visualWarnings": [
      "Auditoria visual: cozinha/área de serviço estreita e datada dos anos 2000 (armários de vidro jateado e granito marrom) e sem AC"
    ]
  },
  "quintoandar:893271548": {
    "modernityScore": 32,
    "modernityTier": "DATED",
    "falseAC": false,
    "hasMaintenanceIssue": false,
    "hardExcludeDated": true,
    "visualWarnings": [
      "Auditoria visual (Ed. Venezuela 361): cozinha anos 70 com interfone e tomadas amarelados, sem elevador"
    ]
  },
  "quintoandar:893299991": {
    "modernityScore": 34,
    "modernityTier": "DATED",
    "falseAC": false,
    "hasMaintenanceIssue": false,
    "hardExcludeDated": true,
    "visualWarnings": [
      "Auditoria visual (Falso Reformado em Botafogo): foto da cozinha revelou azulejo laranja/marrom dos anos 70, calha fluorescente antiga e armário velho"
    ]
  },
  "quintoandar:895684641": {
    "modernityScore": 35,
    "modernityTier": "DATED",
    "falseAC": false,
    "hasMaintenanceIssue": false,
    "hardExcludeDated": true,
    "visualWarnings": [
      "Auditoria visual (Glória 1970): piso cerâmico pequeno com rejunte escuro, geladeira bloqueando o corredor estreito e cômoda antiga desgastada"
    ]
  },
  "quintoandar:895033138": {
    "modernityScore": 38,
    "modernityTier": "DATED",
    "falseAC": false,
    "hasMaintenanceIssue": false,
    "hardExcludeDated": true,
    "visualWarnings": [
      "Auditoria visual (Catete): estrutura fixa da cozinha tem armários de madeira antigos com puxador bolinha, piso pastilhado antigo e lâmpada pendurada sem plafon"
    ]
  },
  "quintoandar:895719467": {
    "modernityScore": 86,
    "modernityTier": "MODERN_OR_RENOVATED",
    "falseAC": false,
    "hasMaintenanceIssue": false,
    "hardExcludeDated": false,
    "visualWarnings": []
  },
  "quintoandar:895371875": {
    "modernityScore": 82,
    "modernityTier": "MODERN_OR_RENOVATED",
    "falseAC": false,
    "hasMaintenanceIssue": false,
    "hardExcludeDated": false,
    "visualWarnings": []
  },
  "quintoandar:894349167": {
    "modernityScore": 58,
    "modernityTier": "STANDARD",
    "verifiedAC": true,
    "falseFreeView": true,
    "verifiedBalcony": true,
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "hardExcludeDated": false,
    "visualWarnings": [
      "Piso cerâmico bege grande, paredes bege, cozinha de granito bege e tanque de coluna: padrão ~2010 sem reforma",
      "Torre vizinha do mesmo condomínio bloqueia metade da vista",
      "Megacondomínio familiar (playground, quadra, brinquedoteca)",
      "Condensadora exposta na varanda; split na suíte (quarto 1 sem)"
    ]
  },
  "quintoandar:895702014": {
    "modernityScore": 42,
    "modernityTier": "DATED",
    "falseAC": true,
    "falseGourmet": true,
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": true,
    "hardExcludeDated": true,
    "visualWarnings": [
      "Infiltração severa, bolhas e descascamento na pintura da parede do quarto",
      "Armários antigos em madeira tom mel/avermelhado com portas molduradas (~2000)",
      "Porta camarão antiga com divisórias quadriculadas de vidro",
      "Sem split de ar-condicionado visível nas fotos",
      "Sem varanda gourmet visível nas fotos (anúncio usa imagem com decoração virtual de IA)"
    ]
  },
  "zapimoveis:2915407598": {
    "modernityScore": 88,
    "modernityTier": "MODERN_OR_RENOVATED",
    "verifiedAC": true,
    "verifiedBalcony": true,
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "hardExcludeDated": false,
    "visualWarnings": [
      "Andar 1: varanda ao nível da rua/jardim",
      "Apenas 1 split visível (suíte)"
    ]
  },
  "quintoandar:895648124": {
    "modernityScore": 86,
    "modernityTier": "MODERN_OR_RENOVATED",
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "hardExcludeDated": false,
    "visualWarnings": []
  },
  "quintoandar:895752152": {
    "modernityScore": 78,
    "modernityTier": "MODERN_OR_RENOVATED",
    "falseAC": true,
    "verifiedAC": false,
    "falseGourmet": false,
    "falseFreeView": false,
    "verifiedBalcony": true,
    "noCabinets": true,
    "floorHint": "MID",
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "hardExcludeDated": false,
    "visualWarnings": [
      "Auditoria visual: sem split visível; cozinha sem nenhum armário (apenas cuba e bancada); quartos sem armários embutidos; varanda real com vista da piscina; prédio novo, unidade vazia"
    ]
  },
  "zapimoveis:2878532384": {
    "modernityScore": 90,
    "modernityTier": "MODERN_OR_RENOVATED",
    "falseAC": false,
    "verifiedAC": true,
    "verifiedBalcony": true,
    "floorHint": "HIGH",
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "hardExcludeDated": false,
    "visualWarnings": [
      "Split visível no quarto e na sala (parede, junto ao teto)"
    ]
  },
  "quintoandar:895774030": {
    "modernityScore": 46,
    "modernityTier": "DATED",
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "hardExcludeDated": true,
    "visualWarnings": [
      "Armários de quarto antigos em madeira avermelhada (mogno/cerejeira) com molduras anos 90",
      "Esquadrias em alumínio natural (cru) sem pintura",
      "Azulejos 20x20 e piso cerâmico pequeno com rejunte escuro na cozinha",
      "Piso cerâmico antigo com borda escura na sala",
      "Aparelho de ar-condicionado split antigo e amarelado"
    ]
  },
  "quintoandar:895748682": {
    "modernityScore": 52,
    "modernityTier": "DATED",
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "hardExcludeDated": true,
    "visualWarnings": [
      "Guarda-roupa antigo em madeira avermelhada (mogno) no quarto",
      "Piso cerâmico quadrado antigo com rejunte escuro aparente na sala e quartos",
      "Azulejos quadrados 20x20 na cozinha e tanque de coluna na lavanderia",
      "Varanda com forro de madeira escuro e grade de ferro antiga"
    ]
  },
  "quintoandar:895746580": {
    "modernityScore": 48,
    "modernityTier": "DATED",
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "hardExcludeDated": true,
    "visualWarnings": [
      "Azulejos de cozinha 20x20 com faixa decorativa antiga (listelo anos 90/2000)",
      "Piso laminado antigo em tom avermelhado/escuro na sala e quartos",
      "Esquadrias em alumínio natural (cru) sem pintura",
      "Quarto sem armários embutidos e luminárias plafon de vidro antigas"
    ]
  },
  "zapimoveis:2897524839": {
    "modernityScore": 88,
    "modernityTier": "MODERN_OR_RENOVATED",
    "falseAC": false,
    "verifiedAC": true,
    "falseGourmet": false,
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "hardExcludeDated": false,
    "visualWarnings": []
  },
  "quintoandar:895560013": {
    "modernityScore": 92,
    "modernityTier": "MODERN_OR_RENOVATED",
    "falseFreeView": false,
    "verifiedBalcony": true,
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "hardExcludeDated": false,
    "visualWarnings": [
      "Prédio novo; sem split instalado (nicho/louver de condensadora na varanda de serviço)",
      "Cozinha americana planejada sem cooktop/forno",
      "Deslocamento 35-40 min até Viracopos"
    ]
  },
  "zapimoveis:2892142503": {
    "modernityScore": 92,
    "modernityTier": "MODERN_OR_RENOVATED",
    "verifiedAC": true,
    "verifiedBalcony": true,
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "hardExcludeDated": false,
    "visualWarnings": [
      "Split visível só na sala; quarto sem aparelho confirmado",
      "Endereço/bairro não informado pelo anúncio (Zap) — Taquaral não verificado",
      "Imóvel também aparece à venda (flag do engine)"
    ]
  },
  "zapimoveis:2908131723": {
    "modernityScore": 86,
    "modernityTier": "MODERN_OR_RENOVATED",
    "verifiedAC": true,
    "verifiedBalcony": true,
    "furnishedTier": "FULLY_FURNISHED",
    "hasMaintenanceIssue": false,
    "hardExcludeDated": false,
    "visualWarnings": [
      "Auditoria visual (Mandarim Guanabara): quarto semi-aberto para a sala (divisória ripada + painel de TV giratório, sem porta) — planta tipo studio; alugado totalmente mobiliado 'como nas fotos' (geladeira, sofá, cama, TV, mesa)"
    ]
  },
  "imovelweb:3036923811": {
    "modernityScore": 91,
    "modernityTier": "MODERN_OR_RENOVATED",
    "verifiedAC": true,
    "hasMaintenanceIssue": false,
    "hardExcludeDated": false,
    "visualWarnings": [
      "Andar baixo; janela da sala dá para cerca viva/muro (sem vista); sem portaria 24h (só portão eletrônico); mesmo imóvel que quintoandar:895715483"
    ]
  },
  "quintoandar:895715483": {
    "modernityScore": 91,
    "modernityTier": "MODERN_OR_RENOVATED",
    "verifiedAC": true,
    "hasMaintenanceIssue": false,
    "hardExcludeDated": false,
    "visualWarnings": [
      "Split visível na sala e no quarto; mesmo imóvel que imovelweb:3036923811"
    ]
  },
  "quintoandar:895773986": {
    "modernityScore": 58,
    "modernityTier": "STANDARD",
    "falseAC": true,
    "furnishedTier": "FULLY_FURNISHED",
    "hasMaintenanceIssue": false,
    "hardExcludeDated": false,
    "visualWarnings": [
      "Auditoria visual (Ed. Mariangela Teixeira): só sala/quarto repaginados (laminado novo); cozinha, banheiro e área de serviço originais anos 90 (fórmica, azulejo pequeno, piso xadrez), janelas antigas e venezianas de madeira no quarto, sem split visível; 'cobertura' e 'varanda' não aparecem nas fotos; mobiliado completo"
    ]
  },
  "quintoandar:895617171": {
    "modernityScore": 86,
    "modernityTier": "MODERN_OR_RENOVATED",
    "falseAC": true,
    "falseGourmet": true,
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "hardExcludeDated": false,
    "visualWarnings": [
      "Auditoria visual (Ed. Malaga): reforma recente (porcelanato cinza, sancas com spots, armários novos), mas janelas originais de alumínio bronze com persiana de enrolar (1996) e sem split instalado — só pontos de infraestrutura",
      "Não possui varanda: terraço integrado à sala (texto do proprietário)",
      "Ao lado do Hospital São Camilo (sirenes)"
    ]
  },
  "quintoandar:895753000": {
    "modernityScore": 90,
    "modernityTier": "MODERN_OR_RENOVATED",
    "verifiedAC": true,
    "falseFreeView": true,
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "hardExcludeDated": false,
    "visualWarnings": [
      "Unidade nova (ripado + LED, vinílico, cooktop/forno), splits na sala",
      "Vista é de torres vizinhas próximas através de janela piso-teto — não é vista livre",
      "Sem varanda verificável: janela piso-teto com guarda-corpo",
      "Descrição fala em mobiliado; fotos e portal sem móveis — confirmar"
    ]
  },
  "quintoandar:894145534": {
    "modernityScore": 82,
    "modernityTier": "MODERN_OR_RENOVATED",
    "verifiedAC": true,
    "floorHint": "LOW",
    "furnishedTier": "FULLY_FURNISHED",
    "hasMaintenanceIssue": false,
    "hardExcludeDated": false,
    "visualWarnings": [
      "Loft/duplex com suíte em mezanino aberto (guarda-corpo de vidro, sem porta) e escada flutuante",
      "Fotos de jul/2023 (3 anos); acabamento ~2012 (pastilha de vidro, granito preto), split só no mezanino",
      "3º andar sobre a Rua Maria Monteiro (eixo comercial/boêmio)",
      "Vista aberta confirmada: piscina do condomínio e cidade a partir da sala"
    ]
  },
  "zapimoveis:2903408622": {
    "modernityScore": 85,
    "modernityTier": "MODERN_OR_RENOVATED",
    "verifiedAC": true,
    "falseGourmet": true,
    "verifiedBalcony": true,
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "hardExcludeDated": false,
    "visualWarnings": [
      "Churrasqueira das fotos é da área comum; varanda da unidade é simples com tela de proteção",
      "Splits na sala e nas duas suítes (confirmados)",
      "Fotos de proprietário, iluminação irregular; última atualização do anúncio 18/08"
    ]
  },
  "zapimoveis:2905000906": {
    "modernityScore": 80,
    "modernityTier": "MODERN_OR_RENOVATED",
    "falseAC": true,
    "verifiedBalcony": true,
    "floorHint": "HIGH",
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "hardExcludeDated": false,
    "visualWarnings": [
      "Edifício/fachada mais antigo (anos 90), porém interior reformado (porcelanato cinza, cozinha com cooktop/forno e armários azuis)",
      "Auditoria visual: o único ar-condicionado é aparelho de janela no quarto (não é split) — sem split instalado"
    ]
  },
  "zapimoveis:2906293013": {
    "modernityScore": 74,
    "modernityTier": "WELL_MAINTAINED",
    "falseAC": false,
    "verifiedAC": true,
    "verifiedBalcony": true,
    "floorHint": "LOW",
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "hardExcludeDated": false,
    "visualWarnings": [
      "Override anterior (falseAC=true) está ERRADO: splits visíveis na sala, no quarto e no corredor",
      "Sacada ao nível das copas das árvores (~2º–3º andar); vista para praça/avenida arborizada",
      "Salão de festas com piso cerâmico simples e cadeiras plásticas"
    ]
  },
  "zapimoveis:2913842750": {
    "modernityScore": 85,
    "modernityTier": "MODERN_OR_RENOVATED",
    "falseAC": true,
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "hardExcludeDated": false,
    "visualWarnings": [
      "Sem split de ar-condicionado instalado visível no interior (apenas espaço técnico na varanda do prédio)"
    ]
  },
  "quintoandar:895781426": {
    "modernityScore": 52,
    "modernityTier": "DATED",
    "falseAC": true,
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "hardExcludeDated": true,
    "visualWarnings": [
      "Piso de pedra ardósia escura na sala e no corredor",
      "Rodapés e batentes em madeira escura antiga",
      "Estante/painel escuro datado e armários com puxadores redondos antigos",
      "Piso cerâmico quadrado antigo no banheiro e cozinha",
      "Sem split de ar-condicionado visível nas fotos"
    ]
  },
  "quintoandar:894469966": {
    "modernityScore": 40,
    "modernityTier": "DATED",
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "hardExcludeDated": true,
    "visualWarnings": [
      "Azulejos pretos e brancos antigos do chão ao teto na cozinha",
      "Piso cerâmico manchado marrom antigo na sala e nos quartos",
      "Esquadrias em alumínio natural (cru) sem pintura",
      "Quartos sem armários embutidos"
    ]
  },
  "zapimoveis:2913843818": {
    "modernityScore": 88,
    "modernityTier": "MODERN_OR_RENOVATED",
    "verifiedAC": true,
    "verifiedBalcony": true,
    "floorHint": "HIGH",
    "furnishedTier": "FULLY_FURNISHED",
    "hasMaintenanceIssue": false,
    "hardExcludeDated": false,
    "visualWarnings": []
  },
  "quintoandar:895748989": {
    "modernityScore": 88,
    "modernityTier": "MODERN_OR_RENOVATED",
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "hardExcludeDated": false,
    "visualWarnings": [
      "Andar baixo (até 3º); vista da varanda dá para casas baixas e prédios ao redor",
      "Área de 52 m² parece pequena nas fotos (inferência; não verificada)",
      "Mesma unidade do rank 130 (Rua Padre Vieira, 52 m², mesmos trilhos de luz, painel ripado e bancada): anunciada no QuintoAndar e no Zap com totais diferentes (QA R$ 4.332 vs Zap R$ 3.750)"
    ]
  },
  "quintoandar:894618527": {
    "modernityScore": 68,
    "modernityTier": "WELL_MAINTAINED",
    "falseAC": false,
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "hardExcludeDated": false,
    "visualWarnings": [
      "Armários de quarto antigos em madeira avermelhada/mel com maleiro e puxadores bola (anos 90/2000)",
      "Piso laminado avermelhado antigo nos quartos",
      "Sem split de ar-condicionado"
    ]
  },
  "zapimoveis:2891916232": {
    "modernityScore": 92,
    "modernityTier": "MODERN_OR_RENOVATED",
    "falseAC": true,
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "hardExcludeDated": false,
    "visualWarnings": [
      "Sem split de ar-condicionado visível nas paredes"
    ]
  },
  "zapimoveis:2914356687": {
    "modernityScore": 66,
    "modernityTier": "STANDARD",
    "verifiedAC": true,
    "verifiedBalcony": true,
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "hardExcludeDated": false,
    "visualWarnings": [
      "Padrão ~2010: cozinha/banheiro/área de serviço com cerâmica pequena clara, bancada de granito bege, piso laminado",
      "Ventilador de teto na sala; split visto só em um quarto",
      "Descrição: 'vista portaria' — sem vista livre"
    ]
  },
  "quintoandar:894151286": {
    "modernityScore": 45,
    "modernityTier": "DATED",
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "hardExcludeDated": true,
    "visualWarnings": [
      "Banheiro antigo com pia de coluna (sem gabinete), espelheira simples e azulejos 15x15 com rejunte escuro",
      "Cozinha com azulejos 15x15 até o teto e armários básicos antigos com puxadores redondos",
      "Piso laminado avermelhado datado e portas de madeira escura",
      "Quartos sem armários embutidos"
    ]
  },
  "quintoandar:895699411": {
    "modernityScore": 35,
    "modernityTier": "DATED",
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "hardExcludeDated": true,
    "visualWarnings": [
      "Piso de pedra ardósia escura na sala e nos quartos",
      "Piso e parede da cozinha em cerâmica 15x15 antiga com rejunte grosso escuro",
      "Armários de cozinha antigos (anos 90) e tanque de coluna na lavanderia",
      "Esquadrias em alumínio cru, ventilador de teto amarelado e guarda-corpo de ferro verde"
    ]
  },
  "quintoandar:895525812": {
    "modernityScore": 50,
    "modernityTier": "DATED",
    "falseGourmet": true,
    "furnishedTier": "FULLY_FURNISHED",
    "hasMaintenanceIssue": true,
    "hardExcludeDated": true,
    "visualWarnings": [
      "Mancha grande de infiltração/umidade amarelada na parede da sala de jantar",
      "Marcenaria divisória/estante e bancada em madeira tom mel com portas tipo veneziana datada (~2000)",
      "Azulejos 15x15 brancos na cozinha",
      "Imóvel totalmente mobiliado (sofá, mesa de vidro com 4 cadeiras, TV) apesar da tag Sem mobília/Semi",
      "Sem varanda gourmet visível nas fotos"
    ]
  },
  "quintoandar:893560095": {
    "modernityScore": 84,
    "modernityTier": "MODERN_OR_RENOVATED",
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "hardExcludeDated": false,
    "visualWarnings": [
      "Piso cerâmico pequeno original na sacada",
      "Quarto em mezanino aberto com escada interna caracol (loft)",
      "Sem lavanderia na unidade — lavanderia coletiva no prédio",
      "Garagem possivelmente com manobrista (prédio Moema Loft)"
    ]
  },
  "quintoandar:895736663": {
    "modernityScore": 66,
    "modernityTier": "WELL_MAINTAINED",
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "hardExcludeDated": false,
    "visualWarnings": [
      "Piso de taco de madeira antigo no mezanino e laminado com desgaste/frestas na sala",
      "Aparelho de ar-condicionado split muito antigo e amarelado no quarto",
      "Azulejos 15x15 brancos na cozinha e janela quadriculada antiga"
    ]
  },
  "quintoandar:895642331": {
    "modernityScore": 94,
    "modernityTier": "MODERN_OR_RENOVATED",
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "hardExcludeDated": false,
    "visualWarnings": []
  },
  "quintoandar:895790971": {
    "modernityScore": 95,
    "modernityTier": "MODERN_OR_RENOVATED",
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "hardExcludeDated": false,
    "visualWarnings": []
  },
  "quintoandar:895613516": {
    "modernityScore": 95,
    "modernityTier": "MODERN_OR_RENOVATED",
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "hardExcludeDated": false,
    "visualWarnings": []
  },
  "quintoandar:895679534": {
    "modernityScore": 90,
    "modernityTier": "MODERN_OR_RENOVATED",
    "falseAC": true,
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "hardExcludeDated": false,
    "visualWarnings": [
      "Sem split de ar-condicionado visível nas paredes nas fotos"
    ]
  },
  "quintoandar:893803444": {
    "modernityScore": 82,
    "modernityTier": "MODERN_OR_RENOVATED",
    "falseGourmet": true,
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "hardExcludeDated": false,
    "visualWarnings": [
      "Varanda envidraçada simples sem churrasqueira gourmet visível",
      "Esquadria da porta da varanda em alumínio prateado padrão"
    ]
  },
  "quintoandar:895723779": {
    "modernityScore": 48,
    "modernityTier": "DATED",
    "falseAC": true,
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "hardExcludeDated": true,
    "visualWarnings": [
      "Armários embutidos antigos em madeira avermelhada (mogno/cerejeira) com puxadores redondos",
      "Azulejos 15x15 brancos até o teto na cozinha e ausência de armários superiores",
      "Esquadrias escuras de padrão antigo",
      "Sem split de ar-condicionado visível nas fotos"
    ]
  },
  "quintoandar:894047645": {
    "modernityScore": 70,
    "modernityTier": "WELL_MAINTAINED",
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "hardExcludeDated": false,
    "visualWarnings": [
      "Azulejos 15x15 antigos com rejunte escurecido na cozinha e área de serviço",
      "Armário de cozinha simples/antigo"
    ]
  },
  "quintoandar:893732528": {
    "modernityScore": 52,
    "modernityTier": "DATED",
    "falseGourmet": true,
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "hardExcludeDated": true,
    "visualWarnings": [
      "Banheiro antigo sem gabinete sob a pia (sifão aparente), bancada de mármore bege antigo e azulejos 20x20",
      "Piso cerâmico pequeno com rejunte escuro no banheiro e dependências de serviço",
      "Janela do quarto em alumínio natural (cru) sem pintura",
      "Sem varanda gourmet visível nas fotos"
    ]
  },
  "quintoandar:893412711": {
    "modernityScore": 56,
    "modernityTier": "DATED",
    "falseAC": true,
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "hardExcludeDated": true,
    "visualWarnings": [
      "Revestimento de parede antigo e azulejos 15x15 na cozinha",
      "Piso cerâmico quadrado antigo com rejunte escuro na cozinha",
      "Esquadrias antigas em alumínio bronze/cru e persianas verticais datadas na sala",
      "Sem split de ar-condicionado visível nas fotos"
    ]
  },
  "quintoandar:893947127": {
    "modernityScore": 65,
    "modernityTier": "WELL_MAINTAINED",
    "falseGourmet": true,
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "hardExcludeDated": false,
    "visualWarnings": [
      "Cozinha com azulejos 15x15 antigos até o teto e armários datados com borda escura",
      "Porta da sacada em alumínio natural (cru) e varanda simples pequena (não gourmet)"
    ]
  },
  "quintoandar:892804231": {
    "modernityScore": 86,
    "modernityTier": "MODERN_OR_RENOVATED",
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "hardExcludeDated": false,
    "visualWarnings": [
      "Cozinha sem gabinete fechado sob a pia (apenas prateleira aberta) e pastilhas vermelhas anos 2010"
    ]
  },
  "quintoandar:893715775": {
    "modernityScore": 42,
    "modernityTier": "DATED",
    "falseGourmet": true,
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "hardExcludeDated": true,
    "visualWarnings": [
      "Banheiro antigo com cortina plástica no chuveiro (sem box de vidro) e piso cerâmico pequeno",
      "Esquadrias grandes em alumínio natural (cru) quadriculadas antigas na sala, quarto, cozinha e banheiro",
      "Guarda-roupa embutido antigo pintado de branco com puxadores redondos anos 90",
      "Cozinha simples com azulejos 20x20 até o teto e apenas gabinete inferior básico",
      "Sem varanda gourmet (não possui varanda)"
    ]
  },
  "quintoandar:895199327": {
    "modernityScore": 78,
    "modernityTier": "WELL_MAINTAINED",
    "hasMaintenanceIssue": false,
    "hardExcludeDated": false,
    "visualWarnings": [
      "Cozinha minimalista: bancada preta, pia simples e poucos armários",
      "Banheiro com pastilhas de vidro e piso de mármore",
      "Nenhum split visível nas fotos de interior"
    ]
  },
  "quintoandar:895722432": {
    "modernityScore": 78,
    "modernityTier": "WELL_MAINTAINED",
    "falseAC": true,
    "verifiedBalcony": true,
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "hardExcludeDated": false,
    "visualWarnings": [
      "Anúncio marca ar-condicionado, mas nenhum split instalado em sala/quartos",
      "Piso porcelanato bege grande e laminado nos quartos; granito preto e armários cinza padrão",
      "Descrição: 2 vagas 'em linha' (presa)",
      "Vista livre não confirmada"
    ]
  },
  "quintoandar:893127481": {
    "modernityScore": 84,
    "modernityTier": "MODERN_OR_RENOVATED",
    "verifiedAC": true,
    "falseFreeView": false,
    "verifiedBalcony": true,
    "noCabinets": true,
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "hardExcludeDated": false,
    "visualWarnings": [
      "Fotos de ago/2020: cozinha só com bancada de granito e sem armários; quarto sem guarda-roupa",
      "Estado atual não confirmado (fotos com ~6 anos)",
      "Entorno hospitalar a ~400 m (sirenes)"
    ]
  },
  "quintoandar:894469434": {
    "modernityScore": 55,
    "modernityTier": "STANDARD",
    "falseAC": true,
    "furnishedTier": "FULLY_FURNISHED",
    "hasMaintenanceIssue": false,
    "hardExcludeDated": false,
    "visualWarnings": [
      "Auditoria visual (Moema Top Life): flat anos 90 mobiliado (madeira mel, cozinha americana compacta com cooktop 2 bocas e armários de madeira/vidro), sem split visível",
      "Área útil aparente ~40–45 m²: os 89 m² declarados provavelmente são área total/registrada"
    ]
  },
  "quintoandar:894663476": {
    "modernityScore": 52,
    "modernityTier": "STANDARD",
    "hasMaintenanceIssue": false,
    "hardExcludeDated": false,
    "visualWarnings": [
      "Tábua corrida escura antiga na sala e quartos (não é taco)",
      "Cozinha reformada (ilha de madeira, cobogó, faixa de ladrilho hidráulico) e 1 banheiro reformado moderno",
      "2º banheiro original bege com bidê e mármore antigo",
      "Hall/áreas comuns antigos (piso de pedra escura, forro de madeira)",
      "Sem AC"
    ]
  },
  "quintoandar:895708603": {
    "modernityScore": 80,
    "modernityTier": "MODERN_OR_RENOVATED",
    "verifiedBalcony": true,
    "furnishedTier": "UNFURNISHED",
    "noCabinets": true,
    "hasMaintenanceIssue": false,
    "hardExcludeDated": false,
    "visualWarnings": [
      "Entrega crua: sem armários, sem box, sem luminárias",
      "Varanda gourmet com pia/bancada e vista panorâmica de andar alto"
    ]
  },
  "zapimoveis:2907744516": {
    "modernityScore": 88,
    "modernityTier": "MODERN_OR_RENOVATED",
    "verifiedAC": true,
    "floorHint": "HIGH",
    "furnishedTier": "FULLY_FURNISHED",
    "hasMaintenanceIssue": false,
    "hardExcludeDated": false,
    "visualWarnings": [
      "Mobiliado sem sofá visível",
      "Imóvel também à venda",
      "Vista com prédios próximos"
    ]
  },
  "quintoandar:895281155": {
    "modernityScore": 38,
    "modernityTier": "DATED",
    "hasMaintenanceIssue": false,
    "hardExcludeDated": true,
    "visualWarnings": [
      "Armários embutidos de madeira escura (mogno/imbuia) anos 80/90",
      "Armários de fórmica antigos na cozinha e banheiro",
      "Esquadrias de alumínio natural antigo",
      "Azulejos 15x15 com faixas decorativas anos 90 na cozinha e no banheiro",
      "Piso cerâmico terroso tipo lajota na cozinha e cerâmica azul antiga no banheiro"
    ]
  },
  "quintoandar:895362019": {
    "modernityScore": 52,
    "modernityTier": "STANDARD",
    "falseAC": true,
    "verifiedBalcony": true,
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "hardExcludeDated": false,
    "visualWarnings": [
      "Cozinha com azulejo/pastilha estilo anos 2000 e granito preto",
      "Armário do quarto em laminado cor de mel",
      "Varanda revestida de pastilha preta; prédio vizinho muito próximo ao nível do andar",
      "Mesmo prédio (Rua Ceará 1620) e mesmas fotos/mobília (futon preto, armário mel, piscina estreita) do rank 32: provável mesma unidade anunciada em QuintoAndar e Zap"
    ]
  },
  "quintoandar:895000407": {
    "modernityScore": 30,
    "modernityTier": "DATED",
    "hasMaintenanceIssue": false,
    "hardExcludeDated": true,
    "visualWarnings": [
      "Louças sanitárias (vaso e bidê) e gabinete verde-abacate dos anos 70/80",
      "Azulejos 15x15 com relevo floral no banheiro e brancos até o teto na cozinha",
      "Piso cerâmico marrom antigo na cozinha e taco desgastado nos quartos",
      "Armários embutidos de madeira escura antiga (mogno/cerejeira)",
      "Esquadrias de alumínio natural antigo"
    ]
  },
  "quintoandar:895346767": {
    "modernityScore": 62,
    "modernityTier": "STANDARD",
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "hardExcludeDated": false,
    "visualWarnings": [
      "Esquadrias de alumínio natural antigo com grade quadriculada",
      "Piso cerâmico branco antigo com rejunte escuro na sala",
      "Ar-condicionado de janela antigo e amarelado no quarto",
      "Revestimento externo em pastilhas marrons antigas no terraço"
    ]
  },
  "zapimoveis:2896936974": {
    "modernityScore": 86,
    "modernityTier": "MODERN_OR_RENOVATED",
    "hasMaintenanceIssue": false,
    "hardExcludeDated": false,
    "visualWarnings": []
  },
  "quintoandar:895741955": {
    "modernityScore": 42,
    "modernityTier": "DATED",
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "hardExcludeDated": true,
    "visualWarnings": [
      "Auditoria visual (Ed. Master Studio): piso de taco de madeira, esquadrias de alumínio preto cru, azulejo 15x15 branco na cozinha e na varanda, granito marrom e portas de madeira com arco — acabamento anos 90",
      "Auditoria visual: sem ar-condicionado e cozinha sem armários visíveis (só bancada de granito e pia)"
    ]
  },
  "quintoandar:895701513": {
    "modernityScore": 46,
    "modernityTier": "DATED",
    "hasMaintenanceIssue": false,
    "hardExcludeDated": true,
    "visualWarnings": [
      "Piso de taco nos quartos e cerâmica antiga com rejunte escuro na sala",
      "Esquadrias de alumínio natural antigo",
      "Azulejos 15x15/20x20 até o teto na cozinha e no banheiro",
      "Armários de padrão antigo (anos 90/2000)"
    ]
  },
  "zapimoveis:2903789730": {
    "modernityScore": 84,
    "modernityTier": "MODERN_OR_RENOVATED",
    "hasMaintenanceIssue": false,
    "hardExcludeDated": false,
    "visualWarnings": [
      "Laminado amadeirado avermelhado no quarto e granito pontilhado (padrão ~2012-2015)",
      "Sem split instalado em nenhum ambiente"
    ]
  },
  "zapimoveis:2915120266": {
    "modernityScore": 88,
    "modernityTier": "MODERN_OR_RENOVATED",
    "falseAC": true,
    "hasMaintenanceIssue": false,
    "hardExcludeDated": false,
    "visualWarnings": [
      "Auditoria visual: ar-condicionado anunciado não confirmado nas fotos"
    ]
  },
  "quintoandar:893007761": {
    "modernityScore": 50,
    "modernityTier": "DATED",
    "hasMaintenanceIssue": false,
    "hardExcludeDated": true,
    "visualWarnings": [
      "Esquadrias de alumínio natural antigo",
      "Piso cerâmico marrom antigo na cozinha",
      "Banheiro com lavatório de coluna (sem gabinete) e faixa decorativa anos 2000",
      "Interfone antigo com fiação aparente"
    ]
  },
  "zapimoveis:2905333868": {
    "modernityScore": 48,
    "modernityTier": "DATED",
    "falseAC": true,
    "hasMaintenanceIssue": false,
    "hardExcludeDated": true,
    "visualWarnings": [
      "Ar-condicionado de janela antigo com fiação aparente (não é split)",
      "Esquadrias de alumínio natural e bronze antigas",
      "Azulejos 15x15/20x20 no banheiro e na área de serviço",
      "Gabinete do banheiro curvo estilo anos 90/2000 e armários de fórmica antigos"
    ]
  },
  "zapimoveis:2909247722": {
    "modernityScore": 88,
    "modernityTier": "MODERN_OR_RENOVATED",
    "hasMaintenanceIssue": false,
    "hardExcludeDated": false,
    "visualWarnings": []
  },
  "quintoandar:894364593": {
    "modernityScore": 92,
    "modernityTier": "MODERN_OR_RENOVATED",
    "falseAC": true,
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "hardExcludeDated": false,
    "visualWarnings": [
      "Auditoria visual: ar-condicionado anunciado não confirmado nas fotos"
    ]
  },
  "zapimoveis:2903971932": {
    "modernityScore": 85,
    "modernityTier": "MODERN_OR_RENOVATED",
    "falseAC": true,
    "hasMaintenanceIssue": false,
    "hardExcludeDated": false,
    "visualWarnings": [
      "Ar-condicionado de janela no quarto (não é split)",
      "Guarda-corpo metálico azul antigo na varanda inferior"
    ]
  },
  "quintoandar:895262148": {
    "modernityScore": 74,
    "modernityTier": "WELL_MAINTAINED",
    "floorHint": "HIGH",
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "hardExcludeDated": false,
    "visualWarnings": [
      "Fotos: cozinha e área de serviço reformadas (armários lisos, cooktop, porcelanato marmorizado) e piso vinílico, mas esquadrias de alumínio natural antigas em sala/quartos e guarda-roupas brancos antigos de prédio velho",
      "Sem split instalado e sem varanda (apenas janelas)",
      "Piscina pequena/antiga de pedra ardósia; prédio com aparência dos anos 80-90"
    ]
  },
  "quintoandar:895740524": {
    "modernityScore": 28,
    "modernityTier": "DATED",
    "hasMaintenanceIssue": false,
    "hardExcludeDated": true,
    "visualWarnings": [
      "Armários de fórmica amarela com moldura de alumínio dos anos 70/80",
      "Azulejos 15x15 estampados/decorados na cozinha e no banheiro",
      "Esquadrias de ferro/alumínio antigo com recorte para AC de janela",
      "Piso cerâmico antigo com rejunte grosso e escuro",
      "Box do banheiro com vidro estampado floral antigo"
    ]
  },
  "zapimoveis:2882523903": {
    "modernityScore": 54,
    "modernityTier": "STANDARD",
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "hardExcludeDated": false,
    "visualWarnings": [
      "Piso cerâmico bege com rejunte escuro e bancada de granito",
      "Varanda pequena sem vista relevante",
      "Endereço não informado no portal (bairro Lourdes)"
    ]
  },
  "zapimoveis:2912062729": {
    "modernityScore": 55,
    "modernityTier": "DATED",
    "hasMaintenanceIssue": false,
    "hardExcludeDated": true,
    "visualWarnings": [
      "Piso cerâmico quadrado com rejunte escuro na sala e no banheiro",
      "Banheiro sem armário/gabinete sob a pia (encanamento aparente)",
      "Esquadrias de alumínio natural simples/antigas",
      "Portas internas em madeira tom mel anos 2000"
    ]
  },
  "zapimoveis:2912507363": {
    "modernityScore": 50,
    "modernityTier": "DATED",
    "falseAC": true,
    "furnishedTier": "FULLY_FURNISHED",
    "hasMaintenanceIssue": false,
    "hardExcludeDated": true,
    "visualWarnings": [
      "Marcenaria em laminado tom mel/cerejeira padrão anos 90/2000 na cozinha e no quarto",
      "Ar-condicionado de janela antigo (não é split)"
    ]
  },
  "zapimoveis:2898905017": {
    "modernityScore": 86,
    "modernityTier": "MODERN_OR_RENOVATED",
    "hasMaintenanceIssue": false,
    "hardExcludeDated": false,
    "visualWarnings": []
  },
  "zapimoveis:2904939900": {
    "modernityScore": 86,
    "modernityTier": "MODERN_OR_RENOVATED",
    "hasMaintenanceIssue": false,
    "hardExcludeDated": false,
    "visualWarnings": []
  },
  "zapimoveis:2812667148": {
    "modernityScore": 38,
    "modernityTier": "DATED",
    "hasMaintenanceIssue": true,
    "hardExcludeDated": true,
    "visualWarnings": [
      "Piso de tábua corrida desgastado e sem verniz",
      "Portas de madeira entalhada anos 80/90 com vidro martelado",
      "Azulejos 15x15 antigos e piso cerâmico pequeno com rejunte escuro na cozinha",
      "Esquadrias de alumínio natural antigo",
      "Armários antigos com moldura de madeira escura e trinca visível na mureta de azulejos"
    ]
  },
  "zapimoveis:2898084596": {
    "modernityScore": 90,
    "modernityTier": "MODERN_OR_RENOVATED",
    "falseAC": true,
    "hasMaintenanceIssue": false,
    "hardExcludeDated": false,
    "visualWarnings": [
      "Auditoria visual: ar-condicionado anunciado não confirmado nas fotos"
    ]
  },
  "quintoandar:893880856": {
    "modernityScore": 88,
    "modernityTier": "MODERN_OR_RENOVATED",
    "falseFreeView": true,
    "noCabinets": false,
    "floorHint": "LOW",
    "hasMaintenanceIssue": false,
    "hardExcludeDated": false,
    "visualWarnings": [
      "Vista livre falsa: árvores/prédios vizinhos próximos",
      "Sem portaria 24h",
      "Andar baixo",
      "Sem AC"
    ]
  },
  "quintoandar:895626344": {
    "modernityScore": 46,
    "modernityTier": "DATED",
    "hasMaintenanceIssue": false,
    "hardExcludeDated": true,
    "visualWarnings": [
      "Azulejos 15x15 antigos no piso e nas paredes do banheiro e na cozinha",
      "Esquadrias de alumínio natural antigo",
      "Depurador de ar bege antigo (anos 90) e armários de fórmica simples",
      "Box do banheiro com estrutura antiga de alumínio escuro"
    ]
  },
  "quintoandar:894892861": {
    "modernityScore": 74,
    "modernityTier": "WELL_MAINTAINED",
    "verifiedAC": true,
    "noCabinets": false,
    "furnishedTier": "FULLY_FURNISHED",
    "hasMaintenanceIssue": false,
    "hardExcludeDated": false,
    "visualWarnings": [
      "Fotos de unidade habitada, desordenada — acabamento neutro (cozinha branca com granito preto, piso bege), não 'moderno/renovado'",
      "Sem varanda e sem vista aberta visíveis (janelas dão para árvores/prédios vizinhos)",
      "Sem fotos de fachada/portaria; portaria 24h ausente",
      "Anúncio publicado há mais de 1 ano (2025-06-21)"
    ]
  },
  "zapimoveis:2917858063": {
    "modernityScore": 92,
    "modernityTier": "MODERN_OR_RENOVATED",
    "furnishedTier": "FULLY_FURNISHED",
    "hasMaintenanceIssue": false,
    "hardExcludeDated": false,
    "visualWarnings": []
  },
  "zapimoveis:2869993530": {
    "modernityScore": 46,
    "modernityTier": "DATED",
    "furnishedTier": "FULLY_FURNISHED",
    "hasMaintenanceIssue": false,
    "hardExcludeDated": true,
    "visualWarnings": [
      "Anúncio de temporada ('AIRBNB ARPOADOR') com valor provavelmente diário (R$ 1.800)",
      "Piso geométrico anos 80/90 na sala e granito/marmorite antigo com rejunte escuro no quarto",
      "Banheiro datado dos anos 90 com azulejos marmorizados e registros redondos marrons",
      "Aparelho de ar-condicionado de piso antigo na sala (embora haja Split no quarto)"
    ]
  },
  "zapimoveis:2917860437": {
    "modernityScore": 90,
    "modernityTier": "MODERN_OR_RENOVATED",
    "furnishedTier": "FULLY_FURNISHED",
    "hasMaintenanceIssue": false,
    "hardExcludeDated": false,
    "visualWarnings": []
  },
  "zapimoveis:2917691743": {
    "modernityScore": 38,
    "modernityTier": "DATED",
    "falseAC": true,
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": true,
    "hardExcludeDated": true,
    "visualWarnings": [
      "Piso de pedra ardósia escura antigo com moldura marrom",
      "Apenas ar-condicionado de janela antigo e amarelado no quarto (sem Split)",
      "Varanda estreita com piso de lajota marrom antiga e guarda-corpo de ferro simples",
      "Banheiro de serviço com azulejos quadrados antigos e porta com veneziana",
      "Fiação elétrica exposta no teto do quarto sem plafon"
    ]
  },
  "zapimoveis:2913295928": {
    "modernityScore": 25,
    "modernityTier": "DATED",
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": true,
    "hardExcludeDated": true,
    "visualWarnings": [
      "Piso cerâmico estampado muito antigo (anos 70/80) nos ambientes",
      "Piso de taco antigo no cômodo adjacente",
      "Cozinha muito antiga com gabinete de pia incompleto/desgastado e armário de fórmica antigo",
      "Esquadrias de alumínio cru antigo com vidro canelado",
      "Box do banheiro em estado precário com estrutura de madeira improvisada sobre o chuveiro e peças soltas no chão"
    ]
  },
  "quintoandar:151269065": {
    "modernityScore": 48,
    "modernityTier": "DATED",
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "hardExcludeDated": true,
    "visualWarnings": [
      "Banheiro datado com gabinete azul de portas em arco e faixa decorativa de pastilhas azuis (anos 90/2000)",
      "Piso de taco de madeira antigo (embora com sinteco novo na sala/quarto)",
      "Janela de alumínio bruto antigo com vidro canelado e azulejos quadrados antigos na área de serviço",
      "Apenas buraco de AC de janela tampado na sala (sem Split)"
    ]
  },
  "zapimoveis:2907039129": {
    "modernityScore": 40,
    "modernityTier": "DATED",
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "hardExcludeDated": true,
    "visualWarnings": [
      "Cozinha com azulejos e piso cerâmico amarelos antigos (anos 70/80) e base de pia em alvenaria azulejada",
      "Piso de taco de madeira escuro antigo nos quartos/sala",
      "Porta interna de madeira com veneziana antiga e lustre de ferro datado",
      "Esquadrias de alumínio simples e apenas buraco de AC de janela tampado (sem Split)"
    ]
  },
  "zapimoveis:2917753256": {
    "modernityScore": 30,
    "modernityTier": "DATED",
    "falseAC": true,
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": true,
    "hardExcludeDated": true,
    "visualWarnings": [
      "Armários embutidos antigos de madeira/fórmica escura dos anos 70/80",
      "Piso cerâmico antigo em xadrez (cinza e terracota) na sala e cerâmica datada nos quartos/cozinha",
      "Cozinha sem gabinete sob a pia (vão aberto com baldes) e azulejos quadrados antigos",
      "Banheiro minúsculo e muito antigo com azulejos bege, rejunte escuro e louças/metais antigos",
      "Apenas AC de janela antigo na sala e buraco de AC tampado com papelão no quarto, além de fiação pendente no teto"
    ]
  },
  "quintoandar:895685385": {
    "modernityScore": 42,
    "modernityTier": "DATED",
    "falseAC": true,
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": true,
    "hardExcludeDated": true,
    "visualWarnings": [
      "Piso de granito/granitina antigo com rejunte aparente e rodapés de madeira escura",
      "Cozinha anos 90 com azulejos brancos com faixa floral azul e armários antigos com portas de vidro de correr",
      "Banheiro datado com teto de lambril de madeira escura, box de vidro fumê, espelho com moldura de madeira e faixa decorativa",
      "Esquadrias de alumínio cru antigo, escada caracol de ferro preta e guarda-corpo de ferro simples",
      "Apenas buraco de AC de janela tampado com madeira (sem Split, apesar da tag de Ar-condicionado) e tomadas com fios expostos"
    ]
  },
  "quintoandar:893790571": {
    "modernityScore": 48,
    "modernityTier": "DATED",
    "falseAC": true,
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "hardExcludeDated": true,
    "visualWarnings": [
      "Armários de cozinha antigos (anos 80/90) com moldura de madeira escura e fórmica creme",
      "Azulejos brancos quadrados pequenos antigos na cozinha com furos aparentes",
      "Marcenaria de quarto datada em dois tons (anos 90/2000)",
      "Janelas de alumínio simples antigas com grade externa e ventiladores de teto antigos com tulipas",
      "Sem ar-condicionado instalado (nem Split nem janela visível, apesar da tag de Ar-condicionado)"
    ]
  },
  "quintoandar:895744985": {
    "modernityScore": 50,
    "modernityTier": "DATED",
    "falseAC": true,
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": true,
    "hardExcludeDated": true,
    "visualWarnings": [
      "Mancha clara de infiltração e pintura descascando na parede lateral da janela",
      "Apenas ar-condicionado de janela antigo instalado no quarto (sem Split visível)",
      "Piso cerâmico bege assentado em diagonal com rejunte aparente",
      "Banheiro com portas de veneziana antigas, box verde com faixa decorativa anos 90 e gabinete datado",
      "Esquadria de alumínio cru no quarto"
    ]
  },
  "quintoandar:894626110": {
    "modernityScore": 42,
    "modernityTier": "DATED",
    "falseAC": true,
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": true,
    "hardExcludeDated": true,
    "visualWarnings": [
      "Cozinha muito datada com armários antigos (anos 80/90) com frisos de madeira escura, azulejos quadrados e piso com rejunte escuro",
      "Piso de taco/parquet antigo com sinteco na sala e quartos",
      "Banheiro antigo com azulejos quadrados bege, box fumê com esquadria marrom, gabinete antigo e buraco de fiação exposta acima do espelho",
      "Varanda com piso cerâmico verde antigo e forro de lambril de madeira",
      "Apenas buraco de AC de janela (sem aparelho instalado, apesar da tag de Ar-condicionado) e interruptores antigos amarelados"
    ]
  },
  "zapimoveis:2908010066": {
    "modernityScore": 44,
    "modernityTier": "DATED",
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "hardExcludeDated": true,
    "visualWarnings": [
      "Piso de taco de madeira antigo nos ambientes principais",
      "Banheiro com azulejos estampados florais antigos (anos 70/80) e acessórios verdes de plástico",
      "Cozinha com azulejos verticais antigos, piso cerâmico datado, janela basculante de alumínio cru e tubulação aparente",
      "Janelas de alumínio padrão antigo e apenas buraco de AC de janela no quarto"
    ]
  },
  "zapimoveis:2915618689": {
    "modernityScore": 66,
    "modernityTier": "WELL_MAINTAINED",
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "hardExcludeDated": false,
    "visualWarnings": [
      "Piso cerâmico quadrado padrão com rejunte aparente na sala",
      "Janela de alumínio anodizado simples e interruptor amarelado na sala"
    ]
  },
  "quintoandar:894813597": {
    "modernityScore": 32,
    "modernityTier": "DATED",
    "falseAC": true,
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": true,
    "hardExcludeDated": true,
    "visualWarnings": [
      "Armários embutidos antigos de madeira escura (anos 70/80) com folha de madeira estufada/descolando no vão central",
      "Cozinha antiga com armários em fórmica amadeirada dos anos 80/90, azulejos quadrados e piso cerâmico com rejunte escuro",
      "Banheiro muito antigo com azulejos bege trabalhados, cuba marrom/terracota, gabinete de madeira antiga e box de alumínio antigo com vidro fosco",
      "Piso de taco antigo com sinteco e esquadrias de alumínio simples com persianas verticais",
      "Apenas ar-condicionado de janela antigo e amarelado no quarto (sem Split)"
    ]
  },
  "zapimoveis:2905231803": {
    "modernityScore": 38,
    "modernityTier": "DATED",
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "hardExcludeDated": true,
    "visualWarnings": [
      "Cozinha e área de serviço com armários antigos (anos 80/90), vidros canelados e azulejos decorados marrons datados",
      "Piso de pedra/cerâmica antigo e desgastado com rejunte escurecido",
      "Janelas basculantes e de correr em alumínio cru antigo com persianas verticais",
      "Apenas buraco de AC de janela na sala (sem Split) e parede de espelhos datada"
    ]
  },
  "quintoandar:895785521": {
    "modernityScore": 85,
    "modernityTier": "MODERN_OR_RENOVATED",
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "hardExcludeDated": false,
    "visualWarnings": []
  },
  "zapimoveis:2916484534": {
    "modernityScore": 40,
    "modernityTier": "DATED",
    "furnishedTier": "FULLY_FURNISHED",
    "hasMaintenanceIssue": false,
    "hardExcludeDated": true,
    "visualWarnings": [
      "Piso de taco antigo em espinha de peixe com sinais de uso",
      "Janelas antigas de alumínio cru com múltiplas divisórias",
      "Área de serviço e banheiro de serviço muito antigos com pastilhas marrons dos anos 80/90 e rejunte encardido",
      "Apenas caixa de ar-condicionado de janela no topo da esquadria (sem Split) e prateleira/móveis de madeira datados"
    ]
  },
  "quintoandar:893155471": {
    "modernityScore": 62,
    "modernityTier": "STANDARD",
    "falseAC": true,
    "furnishedTier": "FULLY_FURNISHED",
    "hasMaintenanceIssue": false,
    "hardExcludeDated": false,
    "visualWarnings": [
      "Ar-condicionado de janela antigo e amarelado na sala (sem Split)",
      "Banheiro datado com azulejos quadrados marmorizados antigos e pia de coluna sem gabinete",
      "Esquadrias de alumínio escuro padrão antigo"
    ]
  },
  "quintoandar:895778787": {
    "modernityScore": 70,
    "modernityTier": "WELL_MAINTAINED",
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "hardExcludeDated": false,
    "visualWarnings": [
      "Ausência total de armários/gabinetes na cozinha e no banheiro (tubulação e sifão totalmente expostos)",
      "Banheiro básico com pia de coluna simples e piso cerâmico padrão"
    ]
  },
  "zapimoveis:2917828133": {
    "modernityScore": 44,
    "modernityTier": "DATED",
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "hardExcludeDated": true,
    "visualWarnings": [
      "Piso cerâmico quadrado antigo com rejunte escuro na sala, banheiro e área de serviço",
      "Banheiro e área de serviço sem armários (lavatório de coluna e tanque simples com sifão aparente)",
      "Janelas basculantes e de correr em alumínio cru antigo",
      "Interruptores antigos amarelados e fachada interna com aparelhos de AC de janela"
    ]
  },
  "quintoandar:895742533": {
    "modernityScore": 46,
    "modernityTier": "DATED",
    "falseAC": true,
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": true,
    "hardExcludeDated": true,
    "visualWarnings": [
      "Paredes do quarto cinza com diversos remendos grandes de massa corrida sem pintar",
      "Apenas ar-condicionado de janela antigo no quarto e buraco de AC na área de serviço (sem Split)",
      "Banheiro datado com azulejos geométricos antigos, bancada/espelho em granito cinza, sifão exposto e torneira de plástico branca",
      "Parede roxa texturizada datada na sala, bocal de lâmpada pendurado no teto e janelas de alumínio bronze antigo",
      "Gabinete inferior da cozinha com portas de correr venezianadas antigas"
    ]
  },
  "quintoandar:893240454": {
    "modernityScore": 70,
    "modernityTier": "WELL_MAINTAINED",
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "hardExcludeDated": false,
    "visualWarnings": [
      "Azulejos e piso brancos quadrados com rejunte escuro na cozinha",
      "Nicho para ar-condicionado de janela no quarto (embora haja Split instalado na sala)"
    ]
  },
  "quintoandar:895740533": {
    "modernityScore": 42,
    "modernityTier": "DATED",
    "falseAC": true,
    "furnishedTier": "FULLY_FURNISHED",
    "hasMaintenanceIssue": false,
    "hardExcludeDated": true,
    "visualWarnings": [
      "Piso de taco escuro na sala e lajota cerâmica vermelha antiga na varanda",
      "Banheiro antigo com forro de lambril de madeira escura e azulejos quadrados pequenos",
      "Cozinha com azulejos quadrados pequenos antigos dos anos 80/90",
      "Apenas ar-condicionado de janela antigo no quarto e buraco de AC tampado na sala (sem Split)"
    ]
  },
  "quintoandar:895704430": {
    "modernityScore": 86,
    "modernityTier": "MODERN_OR_RENOVATED",
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "hardExcludeDated": false,
    "visualWarnings": [
      "Cozinha e banheiro entregues sem gabinetes/armários inferiores (sifão aparente), embora com revestimentos e bancadas novos"
    ]
  },
  "zapimoveis:2910851670": {
    "modernityScore": 38,
    "modernityTier": "DATED",
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": true,
    "hardExcludeDated": true,
    "visualWarnings": [
      "Piso de taco antigo e desgastado com mancha escura grande no canto do quarto",
      "Piso cerâmico marrom marmorizado antigo com rejunte escuro na sala",
      "Armários embutidos antigos dos anos 70/80 com molduras nas portas",
      "Banheiro social com bidê antigo, azulejos com friso decorativo, janela basculante e box de alumínio cru, e aquecedor com tubulação exposta",
      "Banheiro de serviço antigo com azulejos e louças bege/creme"
    ]
  },
  "zapimoveis:2898143388": {
    "modernityScore": 22,
    "modernityTier": "DATED",
    "falseAC": true,
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": true,
    "hardExcludeDated": true,
    "visualWarnings": [
      "Cozinha/área de serviço muito velha com bancada de alvenaria sem armários e piso de pastilhas hexagonais encardidas/desgastadas",
      "Banheiro antigo com azulejos desiguais remendados, vaso sanitário sem tampa, pia de coluna e janela basculante manchada",
      "Piso de taco antigo em espinha de peixe e esquadrias de alumínio cru antigo",
      "Apenas ar-condicionado de janela antigo e amarelado (sem Split)",
      "Canaletas e fiações elétricas expostas sobre os rodapés e azulejos"
    ]
  },
  "quintoandar:895082854": {
    "modernityScore": 38,
    "modernityTier": "DATED",
    "falseAC": true,
    "furnishedTier": "FULLY_FURNISHED",
    "hasMaintenanceIssue": true,
    "hardExcludeDated": true,
    "visualWarnings": [
      "Cozinha muito antiga com bancadas em alvenaria azulejada sem armários planejados, azulejos desiguais e fiação exposta",
      "Piso de taco antigo na sala e nos quartos",
      "Janelas antigas de alumínio simples e basculante no banheiro",
      "Banheiro revestido em pastilhas verdes antigas com chuveiro elétrico de plástico",
      "Sem ar-condicionado visível (apenas ventiladores de teto antigos, apesar da tag de Ar-condicionado)"
    ]
  },
  "quintoandar:895703629": {
    "modernityScore": 33,
    "modernityTier": "DATED",
    "falseAC": true,
    "furnishedTier": "FULLY_FURNISHED",
    "hasMaintenanceIssue": true,
    "hardExcludeDated": true,
    "visualWarnings": [
      "Banheiro extremamente antigo (anos 70/80) com cuba dourada em formato de concha, tampa de vaso verde escura, ventilação circular antiga e manchas amareladas de umidade no teto",
      "Marcenaria embutida pesada e antiga de madeira escura (anos 80) no quarto e arco revestido em madeira na sala",
      "Armários da cozinha com bordas inferiores descascando/estufadas e azulejos quadrados antigos",
      "Piso de taco e tábua corrida antigos com sinteco",
      "Apenas ar-condicionado de janela antigo no quarto (sem Split)"
    ]
  },
  "zapimoveis:2914884153": {
    "modernityScore": 38,
    "modernityTier": "DATED",
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": true,
    "hardExcludeDated": true,
    "visualWarnings": [
      "Marcenaria embutida muito antiga (anos 80/90) em madeira escura com portas em arco no quarto e fórmica bege com frisos marrons no escritório",
      "Banheiro pequeno e antigo com azulejos quadrados brancos, registros antigos e box apenas com varão de cortina (sem vidro)",
      "Área de serviço com piso cerâmico marrom antigo, azulejos quadrados e janelas grandes de alumínio cru antigo",
      "Apenas buraco de AC de janela tampado com painel marrom (sem Split)",
      "Fiação elétrica exposta saindo de buraco na parede do quarto e cabos aparentes no rodapé"
    ]
  },
  "quintoandar:895694297": {
    "modernityScore": 52,
    "modernityTier": "DATED",
    "falseAC": true,
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": true,
    "hardExcludeDated": true,
    "visualWarnings": [
      "Auditoria visual: infiltração/umidade na parede da sala (Foto 20), escada caracol estreita, banheiro anos 90 com bidê e sem split de AC nas paredes"
    ]
  },
  "zapimoveis:2913643725": {
    "modernityScore": 83,
    "modernityTier": "MODERN_OR_RENOVATED",
    "falseAC": true,
    "visualWarnings": [
      "Auditoria visual: anúncio marca ar-condicionado mas só há pontos de infraestrutura (sala e dormitório), nenhum Split instalado",
      "Vaga de garagem rotativa no subsolo (não demarcada)"
    ]
  },
  "zapimoveis:2909939228": {
    "modernityScore": 76,
    "modernityTier": "WELL_MAINTAINED",
    "verifiedAC": true,
    "falseGourmet": true,
    "verifiedBalcony": true,
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "visualWarnings": [
      "Padrão construtora ~2010s sem reforma: portas amadeiradas, bancada de granito preto, porcelanato cinza",
      "Varanda tem só guarda-corpo de vidro — sem churrasqueira/bancada gourmet nas fotos (engine credita 'Varanda gourmet')",
      "Split visível na sala"
    ]
  },
  "zapimoveis:2913737751": {
    "modernityScore": 60,
    "modernityTier": "STANDARD",
    "falseAC": true,
    "falseFreeView": true,
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "hardExcludeDated": false,
    "visualWarnings": [
      "Ar-condicionado de janela no quarto (não é split)",
      "Cozinha e banheiro com revestimento original anos 90/2000 (faixa floral, cerâmica decorada, granito amarelo); só piso laminado e pintura novos",
      "Vaga não demarcada com manobrista (não é vaga livre)"
    ]
  },
  "zapimoveis:2914284775": {
    "modernityScore": 68,
    "modernityTier": "STANDARD",
    "verifiedAC": true,
    "floorHint": "HIGH",
    "furnishedTier": "UNFURNISHED",
    "visualWarnings": [
      "Lustres de cristal, cortinas e acabamentos padrão construtora ~2010s",
      "Semi-mobiliado (armários, fogão, painel de TV, AC, purificador); sem geladeira/sofá/cama declarados → UNFURNISHED correto pela regra de 2 níveis",
      "Split visível apenas na sala"
    ]
  },
  "zapimoveis:2917501636": {
    "modernityScore": 40,
    "modernityTier": "DATED",
    "verifiedAC": true,
    "hasMaintenanceIssue": false,
    "hardExcludeDated": false,
    "visualWarnings": [
      "Auditoria visual: prédio anos 90 — armários creme com portas de vidro, cerâmica branca diagonal, banheiro bege original, esquadrias pretas; fogão de piso; máquina de lavar dentro do banheiro; varanda mínima com tela e vista obstruída"
    ]
  },
  "zapimoveis:2903249333": {
    "modernityScore": 88,
    "modernityTier": "MODERN_OR_RENOVATED",
    "verifiedBalcony": true,
    "floorHint": "HIGH",
    "visualWarnings": [
      "Torre vizinha próxima na frente da varanda; vista livre só em parte",
      "Sem split visível; prédio novo 1ª locação"
    ]
  },
  "zapimoveis:2908605481": {
    "modernityScore": 70,
    "modernityTier": "WELL_MAINTAINED",
    "furnishedTier": "FULLY_FURNISHED",
    "hasMaintenanceIssue": false,
    "visualWarnings": [
      "Auditoria visual: sem ar-condicionado visível em nenhum cômodo; unidade alugada mobiliada (sofá, rack/TV, cama, máquina de lavar) — texto: 'todo mobiliado e equipado'",
      "Auditoria visual: reforma de nível médio (laminado, lambri de madeira, granito, pendentes simples); cozinha ainda com armário de madeira com vidro antigo; torre antiga com hall em mármore"
    ]
  },
  "zapimoveis:2909925946": {
    "modernityScore": 72,
    "modernityTier": "WELL_MAINTAINED",
    "falseAC": true,
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "visualWarnings": [
      "Auditoria visual: ar-condicionado não instalado — o anúncio cita só 'laje técnica para instalar o ar condicionado' (infra pronta nos 2 quartos e sala); unidade vazia sem nenhum split",
      "Acabamento padrão: cozinha com azulejo branco liso e granito preto, porcelanato bege simples; metragem informada 80 m² mas o texto diz 'Apto de 71 metros'"
    ]
  },
  "quintoandar:893318221": {
    "modernityScore": 76,
    "modernityTier": "WELL_MAINTAINED",
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "visualWarnings": [
      "Auditoria visual: sem ar-condicionado visível; acabamento simples (porcelanato claro, laminado nos quartos, cozinha branca com granito)",
      "Auditoria visual: vista da suíte/quarto 2 dá para torres vizinhas e garagem-edifício do shopping — vista só parcialmente livre; condomínio com várias torres (possível megacondomínio)"
    ]
  },
  "zapimoveis:2914707936": {
    "modernityScore": 92,
    "modernityTier": "MODERN_OR_RENOVATED",
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "visualWarnings": [
      "Auditoria visual: sem ar-condicionado visível (apenas grelha de infraestrutura no teto); persiana automatizada na suíte (texto)"
    ]
  },
  "quintoandar:895654350": {
    "modernityScore": 30,
    "modernityTier": "DATED",
    "falseFreeView": true,
    "hasMaintenanceIssue": false,
    "hardExcludeDated": true,
    "visualWarnings": [
      "Auditoria visual (Ed. São Germano): flat anos 90 — piso de granito, armários de madeira/fórmica datados, ventilador de teto, cozinha aberta no mesmo ambiente da sala/cama (planta tipo studio)",
      "Auditoria visual: sem ar-condicionado; a varanda dá para viaduto elevado a poucos metros (ruído e vista bloqueada)",
      "Anúncio também à venda (R$ 520 mil) — risco de o proprietário vender"
    ]
  },
  "quintoandar:892874112": {
    "modernityScore": 28,
    "modernityTier": "DATED",
    "falseAC": true,
    "furnishedTier": "FULLY_FURNISHED",
    "hasMaintenanceIssue": false,
    "hardExcludeDated": true,
    "visualWarnings": [
      "Auditoria visual: apartamento anos 90 totalmente mobiliado com móveis de madeira maciça, cortinas e decoração antigas; cozinha estreita com azulejo branco e armários antigos",
      "Auditoria visual: o ar-condicionado é um aparelho de janela/parede antigo (marrom), sem split"
    ]
  },
  "quintoandar:895719701": {
    "modernityScore": 85,
    "modernityTier": "MODERN_OR_RENOVATED",
    "falseAC": true,
    "falseFreeView": true,
    "verifiedBalcony": true,
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "visualWarnings": [
      "Auditoria visual: o checklist marca ar-condicionado, mas nenhum split está instalado em sala ou quartos nas fotos — unidade nova vazia",
      "Vista da varanda é para edifício-garagem e linha férrea (ruído de trilhos), não vista livre; megacondomínio de várias torres"
    ]
  },
  "zapimoveis:2874113419": {
    "modernityScore": 52,
    "modernityTier": "STANDARD",
    "falseAC": false,
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "visualWarnings": [
      "Acabamentos datados anos 90 (granito/cerâmica escura, marcenaria escura)",
      "Mesmo prédio (Rua Ceará 1620) e mesmas fotos/mobília (futon preto, armário mel, piscina estreita) do rank 12: provável mesma unidade anunciada em QuintoAndar e Zap"
    ]
  },
  "netimoveis:712491": {
    "modernityScore": 70,
    "modernityTier": "WELL_MAINTAINED",
    "falseAC": true,
    "furnishedTier": "FULLY_FURNISHED",
    "visualWarnings": [
      "Studio-like 47 m²",
      "Só 'infraestrutura para ar-condicionado' na descrição; nenhum aparelho instalado"
    ]
  },
  "zapimoveis:2897951683": {
    "modernityScore": 82,
    "modernityTier": "MODERN_OR_RENOVATED",
    "verifiedAC": true,
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "visualWarnings": []
  },
  "zapimoveis:2898051875": {
    "modernityScore": 64,
    "modernityTier": "WELL_MAINTAINED",
    "falseAC": true,
    "floorHint": "HIGH",
    "furnishedTier": "UNFURNISHED",
    "visualWarnings": [
      "AC citado no texto mas nenhum split visível nas 15 fotos",
      "42 m² abaixo do ideal",
      "Fotos antigas/baixa resolução"
    ]
  },
  "zapimoveis:2917803147": {
    "modernityScore": 50,
    "modernityTier": "STANDARD",
    "falseAC": true,
    "furnishedTier": "FULLY_FURNISHED",
    "visualWarnings": [
      "AC é de janela, não split",
      "Mobiliado completo (sofá, cama, TV, geladeira, máquina)",
      "Mobiliário/TV rack de madeira antiga"
    ]
  },
  "zapimoveis:2917613740": {
    "modernityScore": 68,
    "modernityTier": "WELL_MAINTAINED",
    "falseGourmet": true,
    "floorHint": "MID",
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "visualWarnings": [
      "Sem AC",
      "'Varanda gourmet' é área de serviço envidraçada"
    ]
  },
  "zapimoveis:2903987799": {
    "modernityScore": 68,
    "modernityTier": "WELL_MAINTAINED",
    "verifiedAC": true,
    "falseGourmet": true,
    "noCabinets": false,
    "floorHint": "MID",
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "visualWarnings": [
      "Split instalado só em 1 dormitório (sala e 2º quarto sem aparelho visível)",
      "'Varanda gourmet' é lazer do condomínio, não da unidade",
      "Piso laminado/vinílico amadeirado, bancadas de granito preto, armários brancos/azul — conservado mas sem acabamento premium",
      "Descrição diz '2 vagas cobertas' mas portal/título dizem 1 vaga"
    ]
  },
  "zapimoveis:2908655016": {
    "modernityScore": 90,
    "modernityTier": "MODERN_OR_RENOVATED",
    "verifiedAC": true,
    "noCabinets": false,
    "furnishedTier": "FULLY_FURNISHED",
    "hasMaintenanceIssue": false,
    "visualWarnings": [
      "Layout studio/loft: quarto integrado ao ambiente, anunciado como 'studio'",
      "Imóvel também à venda (descrição: 'disponível para venda ou primeira locação')",
      "Vista livre/definitiva e andar alto só por texto; janelas das fotos mostram torres vizinhas em altura próxima (não verificado)",
      "Rua não informada; torre de 43 andares, megacondomínio"
    ]
  },
  "zapimoveis:2870378197": {
    "modernityScore": 55,
    "modernityTier": "STANDARD",
    "verifiedBalcony": true,
    "noCabinets": false,
    "floorHint": "HIGH",
    "furnishedTier": "FULLY_FURNISHED",
    "hasMaintenanceIssue": false,
    "visualWarnings": [
      "Totalmente mobiliado (descrição: 'alugado com todos os móveis') — engine tratou como não mobiliado",
      "Piso de taco/parquet e cerâmica pequena na cozinha, armários pretos/brancos misturados",
      "Split AC não visível; só checklist do portal",
      "Também 'aluga ou vende'",
      "Descrição cita 2 banheiros, portal 1"
    ]
  },
  "zapimoveis:2872525880": {
    "modernityScore": 35,
    "modernityTier": "DATED",
    "verifiedBalcony": true,
    "noCabinets": false,
    "hardExcludeDated": true,
    "visualWarnings": [
      "Piso cerâmico branco 15x15 com rejunte escuro na sala/cozinha e taco de madeira escura nos quartos",
      "Guarda-roupa de madeira com venezianas (anos 90) e armários de cozinha em madeira/laminado antigos",
      "Esquadrias de alumínio marrom antigas; ventilador de teto, sem split",
      "Fotos mostram imóvel mobiliado (sofá, cama, mesa) embora o portal diga sem mobília — confirmar"
    ]
  },
  "zapimoveis:2912083154": {
    "modernityScore": 38,
    "modernityTier": "DATED",
    "verifiedBalcony": true,
    "noCabinets": false,
    "floorHint": "HIGH",
    "furnishedTier": "FULLY_FURNISHED",
    "hardExcludeDated": true,
    "visualWarnings": [
      "Prédio anos 90: piso cerâmico 15x15 claro com rejunte escuro, rodapé e portas de madeira escura, bancada granito marrom",
      "Guarda-roupas e armários de madeira antigos; espelho com moldura dourada",
      "Sem split; só grelha de ventilação sob a janela",
      "Mobiliado (sofá, cama, mesa, escrivaninha, geladeira) — slug do anúncio e amenity FURNISHED, mas engine tratou como não mobiliado",
      "Gesso rebaixado antigo com sanca"
    ]
  },
  "quintoandar:895771915": {
    "modernityScore": 95,
    "modernityTier": "MODERN_OR_RENOVATED",
    "verifiedAC": true,
    "verifiedBalcony": true,
    "noCabinets": false,
    "floorHint": "HIGH",
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "visualWarnings": [
      "Studio-like compacto de 40 m² (penalidade de área já aplicada)",
      "Varanda integrada à sala e fechada com vidro",
      "Barro Preto: segurança -15,6 já aplicada"
    ]
  },
  "zapimoveis:2892963574": {
    "modernityScore": 88,
    "modernityTier": "MODERN_OR_RENOVATED",
    "noCabinets": false,
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "visualWarnings": [
      "Fotos de unidade habitada (móveis de moradores)",
      "Sem split; apenas ventilador de teto",
      "Prédio de 6 pavimentos sem portaria (interfone), 1 elevador",
      "Título 'com jardim' + corredor com janelas altas sugere unidade térrea/garden — andar não confirmado",
      "Também à venda"
    ]
  },
  "zapimoveis:2912932429": {
    "modernityScore": 80,
    "modernityTier": "MODERN_OR_RENOVATED",
    "verifiedAC": false,
    "falseGourmet": true,
    "verifiedBalcony": true,
    "noCabinets": false,
    "floorHint": "HIGH",
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "visualWarnings": [
      "Fotos da sala com sofá e split são do apartamento decorado da construtora — a unidade real está vazia, sem aparelho de AC",
      "Só infraestrutura para AC (confirmado pelo texto)",
      "Varanda gourmet é lazer do condomínio",
      "Fotos do prédio nunca habitado (1ª locação provável); 45 m² com 2 quartos pequenos"
    ]
  },
  "zapimoveis:2908621159": {
    "modernityScore": 82,
    "modernityTier": "MODERN_OR_RENOVATED",
    "verifiedAC": true,
    "verifiedBalcony": true,
    "noCabinets": false,
    "furnishedTier": "FULLY_FURNISHED",
    "hasMaintenanceIssue": false,
    "visualWarnings": [
      "Studio de ambiente único (sofá-cama + cama no mesmo cômodo), anunciado como '1 quarto'",
      "Portaria 'inteligente' com controle de acesso (24h humana não confirmada)",
      "Piso laminado, acabamento padrão contemporâneo",
      "Cobertura do prédio tem spa/sauna e lavanderia self-service"
    ]
  },
  "zapimoveis:2915406375": {
    "modernityScore": 76,
    "modernityTier": "WELL_MAINTAINED",
    "falseAC": true,
    "falseGourmet": true,
    "floorHint": "LOW",
    "furnishedTier": "UNFURNISHED",
    "visualWarnings": [
      "Nenhum split visível na sala, nos 2 quartos nem na cozinha (checklist do portal marca AR_CONDICIONADO)",
      "'Varanda gourmet' não aparece: sacada pequena de grade, sem bancada/churrasqueira",
      "Descrição fala em 'casa' de 80 m² com quintal privativo, mas as fotos são de apartamento compacto em torre: texto parece de outro imóvel",
      "Cozinha tipo kitchenette com armários verdes/madeira e bancada de granito, sem cooktop visível"
    ]
  },
  "quintoandar:895149850": {
    "modernityScore": 80,
    "modernityTier": "WELL_MAINTAINED",
    "floorHint": "MID",
    "furnishedTier": "FULLY_FURNISHED",
    "visualWarnings": [
      "Mobiliado completo (sofá, TV, cama, geladeira) em 39 m²",
      "Acabamento padrão 2019: piso de porcelanato polido tipo granito, bancadas de granito, portas de madeira; bom, mas não 'MODERN 100'"
    ]
  },
  "zapimoveis:2900192614": {
    "modernityScore": 58,
    "modernityTier": "STANDARD",
    "falseAC": true,
    "floorHint": "MID",
    "furnishedTier": "UNFURNISHED",
    "visualWarnings": [
      "Piso de granito polido, bancadas de granito preto, paredes de azulejo branco 15x15 e portas de madeira: acabamento anos 2000, não moderno",
      "Sem split visível na sala nem no quarto (apenas checklist do portal marca AC)",
      "Portaria é VIRTUAL com reconhecimento facial (descrição), não portaria 24h presencial",
      "Térreo comercial/entrada estreita sobre rua com movimento"
    ]
  },
  "quintoandar:895653161": {
    "modernityScore": 38,
    "modernityTier": "DATED",
    "falseAC": false,
    "verifiedBalcony": false,
    "noCabinets": false,
    "floorHint": "MID",
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "hardExcludeDated": true,
    "visualWarnings": [
      "'Totalmente reformado' não procede nas áreas molhadas/cozinha: azulejo bege/branco 15x15, piso cerâmico branco antigo, janelas de tijolo de vidro",
      "Piso cinza escuro tipo ardósia/granilite com rodapé escuro em sala e quartos; ventilador de teto, sem AC",
      "Posto de gasolina e casas baixas em frente (ruído/cheiro); prédio anos 70/80 com hall e salão antigos",
      "Portaria presencial só seg–sáb 8h–18h (não 24h)"
    ]
  },
  "vivareal:2900562274": {
    "modernityScore": 82,
    "modernityTier": "MODERN_OR_RENOVATED",
    "falseAC": false,
    "verifiedBalcony": true,
    "floorHint": "MID",
    "furnishedTier": "UNFURNISHED",
    "visualWarnings": [
      "Primeira locação, unidade vazia; sem split instalado (nem preparo visível)",
      "Varanda com bancada/armário embutidos mas vista para rua e prédios vizinhos (não é vista livre)"
    ]
  },
  "zapimoveis:2910065030": {
    "modernityScore": 74,
    "modernityTier": "WELL_MAINTAINED",
    "falseAC": false,
    "verifiedAC": true,
    "furnishedTier": "UNFURNISHED",
    "visualWarnings": [
      "Estilo industrial: teto de concreto aparente com eletrocalhas",
      "Cozinha corredor estreita com janelas altas",
      "Descrição: 'imóvel em processo de rescisão' (ocupado/volta ao mercado)"
    ]
  },
  "zapimoveis:2906497144": {
    "modernityScore": 35,
    "modernityTier": "DATED",
    "verifiedBalcony": true,
    "floorHint": "HIGH",
    "furnishedTier": "UNFURNISHED",
    "hardExcludeDated": true,
    "visualWarnings": [
      "Piso vinílico/laminado bege antigo e rodapé escuro na sala/quarto",
      "Banheiros e cozinha com azulejo/piso cerâmico 15x15 branco com faixa azul e armários de madeira antigos",
      "Prédio anos 90 com piscina e sauna de azulejo; áreas comuns datadas"
    ]
  },
  "zapimoveis:2899693891": {
    "modernityScore": 52,
    "modernityTier": "STANDARD",
    "falseAC": false,
    "verifiedAC": true,
    "floorHint": "HIGH",
    "furnishedTier": "UNFURNISHED",
    "visualWarnings": [
      "Vagas 'de gaveta' (descrição): não são livres e demarcadas",
      "Piso de cerâmica branca brilhante e paredes bege/marrom pintadas: padrão 2010 econômico",
      "Teto com ventilador nos quartos"
    ]
  },
  "zapimoveis:2906171922": {
    "modernityScore": 82,
    "modernityTier": "MODERN_OR_RENOVATED",
    "falseAC": false,
    "verifiedBalcony": true,
    "floorHint": "HIGH",
    "furnishedTier": "UNFURNISHED",
    "visualWarnings": [
      "Sem split nem preparo visível (sala, quarto, cozinha)",
      "Descrição cita 'Edifício Beverly Hills', mas as fotos mostram torre de alto padrão com lazer envidraçado; vale confirmar o prédio"
    ]
  },
  "quintoandar:894407889": {
    "modernityScore": 64,
    "modernityTier": "STANDARD",
    "falseAC": false,
    "falseGourmet": false,
    "falseFreeView": false,
    "verifiedBalcony": false,
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "visualWarnings": [
      "Auditoria visual: sem split visível em nenhum cômodo; sem varanda (só janelas); cozinha em nível rebaixado com guarda-corpo (meio-nível); acabamento padrão de construtora, piso laminado claro e porcelanato bege na cozinha"
    ]
  },
  "quintoandar:893083464": {
    "modernityScore": 76,
    "modernityTier": "WELL_MAINTAINED",
    "falseAC": false,
    "falseGourmet": false,
    "falseFreeView": true,
    "verifiedBalcony": false,
    "noCabinets": false,
    "floorHint": "LOW",
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "visualWarnings": [
      "Auditoria visual: 'vista livre' é falsa — janelas dão para talude/muro de contenção e prédios vizinhos a poucos metros; sem elevador (escada), sem portaria; cozinha antiga (granito escuro, azulejo 15x15 branco, armários superiores antigos) contrastando com sala reformada"
    ]
  },
  "zapimoveis:2917522017": {
    "modernityScore": 68,
    "modernityTier": "STANDARD",
    "falseGourmet": false,
    "falseFreeView": false,
    "verifiedBalcony": true,
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "visualWarnings": [
      "Auditoria visual: apenas a condensadora de AC aparece na varanda; nenhuma evaporadora (split) visível na sala ou nos quartos — AC não confirmado nas fotos"
    ]
  },
  "quintoandar:895696163": {
    "modernityScore": 74,
    "modernityTier": "WELL_MAINTAINED",
    "falseAC": false,
    "falseGourmet": false,
    "furnishedTier": "FULLY_FURNISHED",
    "hasMaintenanceIssue": false,
    "visualWarnings": [
      "Auditoria visual: studio industrial reformado em prédio antigo (taco/parquet em espinha, tijolo aparente), quarto aberto para a sala (só cortina), unidade de parede ambígua perto do quarto (não confirmada como split), totalmente mobiliado"
    ]
  },
  "zapimoveis:2896767993": {
    "modernityScore": 86,
    "modernityTier": "MODERN_OR_RENOVATED",
    "falseAC": false,
    "verifiedAC": true,
    "falseGourmet": false,
    "falseFreeView": false,
    "verifiedBalcony": true,
    "noCabinets": false,
    "furnishedTier": "FULLY_FURNISHED",
    "hasMaintenanceIssue": false,
    "visualWarnings": [
      "Auditoria visual: dois splits instalados (sala e quarto); varanda envidraçada; totalmente mobiliado e equipado; studio 42 m²"
    ]
  },
  "quintoandar:893379716": {
    "modernityScore": 34,
    "modernityTier": "DATED",
    "falseAC": false,
    "falseGourmet": false,
    "falseFreeView": false,
    "noCabinets": false,
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "hardExcludeDated": true,
    "visualWarnings": [
      "Auditoria visual: guarda-roupa de madeira maciça envernizada antigo, azulejo 15x15 branco com faixa decorativa floral, laminado desgastado, banheiros/área de serviço dos anos 90, sem AC — 'Novo/Reformado' do portal é falso"
    ]
  },
  "zapimoveis:2914899911": {
    "modernityScore": 52,
    "modernityTier": "STANDARD",
    "falseAC": false,
    "falseGourmet": false,
    "falseFreeView": false,
    "verifiedBalcony": false,
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "visualWarnings": [
      "Auditoria visual: apartamento básico anos 2000 — cerâmica clara com rejunte aparente, janelas de alumínio, portas de madeira, banheiros simples, sem AC, sem varanda; 3 quartos pequenos em 60 m²"
    ]
  },
  "zapimoveis:2903285501": {
    "modernityScore": 84,
    "modernityTier": "MODERN_OR_RENOVATED",
    "falseAC": false,
    "verifiedAC": false,
    "falseGourmet": false,
    "falseFreeView": false,
    "verifiedBalcony": true,
    "noCabinets": false,
    "floorHint": "MID",
    "furnishedTier": "FULLY_FURNISHED",
    "hasMaintenanceIssue": false,
    "visualWarnings": [
      "Auditoria visual: apartamento totalmente mobiliado (sofá, mesa, cama, TV); ar-condicionado é aparelho de janela, não split; varanda com tela de proteção e vista da piscina; cozinha e banheiro reformados"
    ]
  },
  "imovelweb:3002836784": {
    "modernityScore": 56,
    "modernityTier": "STANDARD",
    "falseAC": false,
    "falseGourmet": false,
    "falseFreeView": false,
    "verifiedBalcony": true,
    "noCabinets": false,
    "furnishedTier": "FULLY_FURNISHED",
    "hasMaintenanceIssue": false,
    "visualWarnings": [
      "Auditoria visual: duplex/loft com quarto em mezanino aberto para a sala (escada metálica), mobiliado, bancadas de granito simples, sem split visível, sacada pequena circular; prédio estilo flat com condomínio R$ 1.430"
    ]
  },
  "quintoandar:895788295": {
    "modernityScore": 50,
    "modernityTier": "STANDARD",
    "falseAC": false,
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "visualWarnings": [
      "Auditoria visual: prédio antigo (anos 80/90) — cozinha com azulejo bege, faixa decorativa e granito escuro; banheiro de serviço bege datado; armário de quarto em madeira escura; sem split (apenas ventilador de teto)"
    ]
  },
  "zapimoveis:2903286308": {
    "modernityScore": 36,
    "modernityTier": "DATED",
    "falseAC": false,
    "furnishedTier": "FULLY_FURNISHED",
    "hasMaintenanceIssue": false,
    "visualWarnings": [
      "Auditoria visual (Lourdes, R. Bernardo Guimarães): unidade MOBILIADA (sofá, cama com colchão, geladeira, fogão, escrivaninha); cozinha anos 80/90 com azulejo bege, granito e piso taco/terracota; banheiro com azulejo em relevo e rejunte escuro; armário de quarto em madeira escura; sem ar-condicionado"
    ]
  },
  "quintoandar:895787012": {
    "modernityScore": 40,
    "modernityTier": "DATED",
    "falseAC": false,
    "floorHint": "HIGH",
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "visualWarnings": [
      "Auditoria visual (Lungomare, Icaraí): granito polido e cozinha/banheiros anos 90 (azulejo bege, bancada de vidro, armários com porta de vidro, gabinete de madeira escura); sem split (aparelhos de janela soltos na sala); vistas para vãos entre torres/poço de ventilação"
    ]
  },
  "quintoandar:895791339": {
    "modernityScore": 45,
    "modernityTier": "STANDARD",
    "falseAC": false,
    "verifiedBalcony": true,
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "visualWarnings": [
      "Auditoria visual (R. dos Bandeirantes 21): sala com piso de ardósia escura, quartos com parquê/sinteco avermelhado e armários de madeira avermelhada antigos; sem split; sacada pequena com tela voltada a prédio vizinho"
    ]
  },
  "zapimoveis:2897868779": {
    "modernityScore": 48,
    "modernityTier": "STANDARD",
    "falseAC": false,
    "verifiedBalcony": true,
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "visualWarnings": [
      "Fotos do anúncio têm carimbo de 2013/2014 (08.03.2014 e 28.06.2013) e mostram móveis que a descrição diz terem sido retirados; piso cerâmico claro, armários de madeira amarela, bancada-bar; sem split"
    ]
  },
  "quintoandar:893372211": {
    "modernityScore": 40,
    "modernityTier": "DATED",
    "falseAC": false,
    "verifiedBalcony": true,
    "floorHint": "MID",
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "visualWarnings": [
      "Auditoria visual (Acácia Real): apartamento dos anos 90 — cerâmica bege com rejunte, armários embutidos em madeira avermelhada com puxadores dourados, banheiros com azulejo estampado, esquadrias de alumínio preto; sem split; anúncio em relocação antecipada (contrato atual em rescisão)"
    ]
  },
  "quintoandar:893483393": {
    "modernityScore": 42,
    "modernityTier": "DATED",
    "falseAC": false,
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "visualWarnings": [
      "Auditoria visual (Ed. Ursini): cerâmica clara antiga, azulejo rosado na cozinha, bancada de granito e banheiro anos 90; sem split. Anúncio suspenso na página"
    ]
  },
  "zapimoveis:2913974900": {
    "modernityScore": 86,
    "modernityTier": "MODERN_OR_RENOVATED",
    "falseAC": false,
    "verifiedBalcony": true,
    "noCabinets": true,
    "floorHint": "HIGH",
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "visualWarnings": [
      "Unidade nova entregue em casca: cozinha sem armários (só bancada de granito/cuba) e sem armários de quarto; sem split instalado (aparelhos só nas áreas comuns)"
    ]
  },
  "quintoandar:895706084": {
    "modernityScore": 38,
    "modernityTier": "DATED",
    "falseAC": false,
    "falseFreeView": true,
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "visualWarnings": [
      "Auditoria visual (Ed. Montreal): cozinha e área de serviço com piso terracota e azulejo bege, banheiro com bidê e louça anos 80/90; torres vizinhas a ~10–15 m e obra ativa ao lado; sem split"
    ]
  },
  "zapimoveis:2902131951": {
    "modernityScore": 52,
    "modernityTier": "STANDARD",
    "verifiedAC": true,
    "falseGourmet": true,
    "furnishedTier": "FULLY_FURNISHED",
    "hasMaintenanceIssue": false,
    "visualWarnings": [
      "Auditoria visual: unidade mobiliada e habitada (cama, sofá, mesa, geladeira) — descrição diz 'MOBILIADO TOTALMENTE' mas o portal marca não mobiliado",
      "Cozinha com granito/armários antigos e azulejo pequeno; piso de madeira/taco desgastado; esquadrias pretas simples",
      "Sacada pequena comum (não é varanda gourmet); vista para prédios vizinhos/rua",
      "Imóvel também à venda"
    ]
  },
  "zapimoveis:2917561138": {
    "modernityScore": 42,
    "modernityTier": "DATED",
    "verifiedAC": false,
    "verifiedBalcony": true,
    "floorHint": "MID",
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "visualWarnings": [
      "Auditoria visual: prédio anos 90 — granilite/terrazzo no hall, guarda-roupa de madeira escura antigo, banheiro com azulejo branco pequeno e bancada de granito, piso laminado",
      "Sem split instalado em nenhuma das fotos",
      "Terraço amplo descoberto (ponto positivo), mas piso manchado"
    ]
  },
  "quintoandar:895020185": {
    "modernityScore": 86,
    "modernityTier": "MODERN_OR_RENOVATED",
    "verifiedAC": true,
    "verifiedBalcony": true,
    "floorHint": "HIGH",
    "furnishedTier": "FULLY_FURNISHED",
    "hasMaintenanceIssue": false,
    "visualWarnings": [
      "Auditoria visual: split instalado na sala/jantar e no quarto; condensadora na varanda (descrição fala só em 'infraestrutura')",
      "Unidade reformada (vinílico amadeirado, gesso com LED, cozinha planejada, banheiros em porcelanato grande); móveis são do morador atual — confirmar se ficam (portal marca mobiliado)",
      "Galeria mistura fotos de outras unidades/prédios (arquivos com prefixo de outros IDs, ex.: sala com piso escuro e pilar)",
      "Vista aberta sobre telhados/cidade da varanda"
    ]
  },
  "zapimoveis:2916450166": {
    "modernityScore": 72,
    "modernityTier": "WELL_MAINTAINED",
    "verifiedAC": true,
    "floorHint": "MID",
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "visualWarnings": [
      "Auditoria visual: split no quarto (visível nas fotos); sala/cozinha integrada com ilha, painel/marcenaria planejada e espelho",
      "Layout compacto tipo studio (42 m²); janelas dão para prédios vizinhos (sem vista livre)",
      "Piso de granito polido na sala (estilo ~2010), vinílico no quarto"
    ]
  },
  "zapimoveis:2905603742": {
    "modernityScore": 66,
    "modernityTier": "WELL_MAINTAINED",
    "verifiedAC": true,
    "furnishedTier": "FULLY_FURNISHED",
    "hasMaintenanceIssue": false,
    "visualWarnings": [
      "Auditoria visual: apartamento mobiliado (cama, sofá, mesa, geladeira, painel de TV) — portal/URL dizem 'mobiliado' mas engine tratou como não mobiliado",
      "Split no quarto; piso de granito polido na sala; janelas para prédios vizinhos",
      "Acabamento e prédio semelhantes ao rank 84 (mesmo padrão de marcenaria) — possível mesmo empreendimento (inferência)"
    ]
  },
  "zapimoveis:2899556838": {
    "modernityScore": 40,
    "modernityTier": "DATED",
    "verifiedAC": false,
    "floorHint": "MID",
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "visualWarnings": [
      "Auditoria visual: piso de cerâmica bege com rejunte (não é porcelanato moderno), paredes amarelas, guarda-roupas brancos antigos, cozinha com azulejo pequeno e granito escuro",
      "Sem split nas fotos",
      "Entorno hospitalar (Santa Casa) — sirenes"
    ]
  },
  "zapimoveis:2907812255": {
    "modernityScore": 60,
    "modernityTier": "STANDARD",
    "verifiedAC": false,
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "visualWarnings": [
      "Auditoria visual: sala com granito cinza polido (não porcelanato), quartos em laminado, cozinha com bancada de granito preto e armários brancos; sem split",
      "Área de 67 m² inclui área privativa externa (parte coberta) usada como área de serviço — 1 quarto interno é bem menor",
      "Janelas para prédios vizinhos; sem vista livre verificada"
    ]
  },
  "zapimoveis:2916439228": {
    "modernityScore": 52,
    "modernityTier": "STANDARD",
    "verifiedAC": false,
    "floorHint": "HIGH",
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "visualWarnings": [
      "Auditoria visual: padrão construtora — piso cerâmico bege, paredes amarelas, armários brancos simples, sem split; maioria das fotos é de áreas comuns",
      "Megacondomínio (várias torres, brinquedoteca, quadra, salão de jogos, playground)",
      "Varanda dá para rua/prédios; 3 quartos em 69 m²"
    ]
  },
  "zapimoveis:2897994086": {
    "modernityScore": 40,
    "modernityTier": "DATED",
    "verifiedAC": true,
    "verifiedBalcony": false,
    "furnishedTier": "FULLY_FURNISHED",
    "hasMaintenanceIssue": false,
    "visualWarnings": [
      "Auditoria visual: apartamento mobiliado estilo flat/short-stay (cama, sofá, mesa, frigobar, roupa de cama decorada) — engine tratou como não mobiliado (+15)",
      "Madeira escura, granito antigo e kitchenette compacta; modernidade ~40",
      "Splits na sala e no quarto; frigobar (não geladeira) na kitchenette",
      "Condomínio R$ 1.280 (32% do total) — padrão de flat/apart-hotel"
    ]
  },
  "zapimoveis:2909942920": {
    "modernityScore": 76,
    "modernityTier": "WELL_MAINTAINED",
    "verifiedAC": true,
    "floorHint": "HIGH",
    "furnishedTier": "UNFURNISHED",
    "visualWarnings": [
      "Auditoria visual: split instalado visível no quarto, acima do painel de TV (foto 6); texto diz 'Condicionador de ar'. Layout tipo studio (quarto separado só por marcenaria)."
    ]
  },
  "zapimoveis:2903483629": {
    "modernityScore": 64,
    "modernityTier": "STANDARD",
    "floorHint": "HIGH",
    "furnishedTier": "UNFURNISHED",
    "visualWarnings": [
      "Auditoria visual: mesma unidade do rank 92 (duplicata de outra imobiliária); AC não aparece nas fotos deste anúncio nem no texto; split só visível nas fotos do anúncio gêmeo."
    ]
  },
  "quintoandar:895640445": {
    "modernityScore": 38,
    "modernityTier": "DATED",
    "falseAC": true,
    "floorHint": "HIGH",
    "furnishedTier": "FULLY_FURNISHED",
    "visualWarnings": [
      "Auditoria visual: acabamento anos 80-90 (granito manchado, azulejo bege antigo, armários antigos, janelas com grade); sem split instalado."
    ]
  },
  "quintoandar:130272562": {
    "modernityScore": 16,
    "modernityTier": "DATED",
    "falseAC": true,
    "floorHint": "HIGH",
    "hardExcludeDated": true,
    "visualWarnings": [
      "Auditoria visual: acabamento anos 70-80 (piso vinílico estampado vermelho, azulejo floral, pia amarela, azulejo bege quadriculado na cozinha); sem ar-condicionado instalado."
    ]
  },
  "quintoandar:894316463": {
    "modernityScore": 49,
    "modernityTier": "DATED",
    "verifiedBalcony": true,
    "floorHint": "HIGH",
    "visualWarnings": [
      "Auditoria visual: acabamento anos 90 (piso cerâmico claro, granito, armários de madeira com vidro); varanda envidraçada pequena; sem split instalado."
    ]
  },
  "zapimoveis:2871284717": {
    "modernityScore": 45,
    "modernityTier": "DATED",
    "falseAC": true,
    "verifiedBalcony": true,
    "floorHint": "HIGH",
    "visualWarnings": [
      "Auditoria visual: torre dos anos 90; piso laminado manchado, roupeiros escuros antigos, cozinha cerâmica creme; apenas furo/ponto de AC de parede, sem split instalado."
    ]
  },
  "imovelweb:3044267399": {
    "modernityScore": 55,
    "modernityTier": "STANDARD",
    "falseAC": true,
    "visualWarnings": [
      "Auditoria visual (apenas 4 fotos): prédio anos 90-2000, piso cerâmico bege, esquadrias de alumínio escuro; sem split visível; cozinha/varanda/andar não verificados."
    ]
  },
  "quintoandar:893945990": {
    "modernityScore": 60,
    "modernityTier": "STANDARD",
    "falseFreeView": true,
    "verifiedBalcony": true,
    "floorHint": "HIGH",
    "furnishedTier": "FULLY_FURNISHED",
    "visualWarnings": [
      "Auditoria visual: janelas dão para prédios vizinhos (sem vista livre); varanda envidraçada grande, sem churrasqueira/gourmet visível; sem split instalado."
    ]
  },
  "zapimoveis:2900134401": {
    "modernityScore": 89,
    "modernityTier": "MODERN_OR_RENOVATED",
    "furnishedTier": "UNFURNISHED",
    "visualWarnings": [
      "Auditoria visual: prédio novo com rooftop; unidade tipo studio (quarto separado por marcenaria ripada); sem split nem varanda visíveis."
    ]
  },
  "quintoandar:895392428": {
    "modernityScore": 84,
    "modernityTier": "MODERN_OR_RENOVATED",
    "verifiedBalcony": false,
    "visualWarnings": [
      "Auditoria visual (ALDEA Vale do Sereno, Nova Lima): unidade nova com porcelanato, cozinha planejada em cinza com bancada preta, guarda-roupa de correr; planta aberta tipo studio (portal legenda todos os cômodos como 'Studio')",
      "'Varanda' é um bay envidraçado integrado à sala (sem área aberta); sem AC split instalado nas fotos; vista parcial (torres vizinhas próximas)"
    ]
  },
  "zapimoveis:2895433710": {
    "modernityScore": 58,
    "modernityTier": "STANDARD",
    "furnishedTier": "FULLY_FURNISHED",
    "visualWarnings": [
      "Auditoria visual: esquadrias de madeira/alumínio escuro com tela e grade, painel de madeira escura na sala, cozinha estreita datada (bancada bege, azulejo pequeno, fogão e geladeira simples), banheiro com piso preto e forro de madeira — 'reformado' é só piso porcelanato brilhante + spots de gesso",
      "Sem ar-condicionado visível; cama box sem colchão; mobília usada (sofá, mesa de vidro)",
      "Anúncio também à venda (texto: 'Imovel tambem para venda') — não detectado pelo motor"
    ]
  },
  "quintoandar:894262518": {
    "modernityScore": 58,
    "modernityTier": "STANDARD",
    "verifiedAC": true,
    "visualWarnings": [
      "Auditoria visual (Ed. Marbella): split na sala confirmado; cozinha datada (armários bege/madeira, azulejo pequeno), banheiro com bancada de mármore clara e armário antigo; varanda real com tela de proteção",
      "Vista com torres vizinhas próximas e telhados — ampla mas não 'livre/definitiva' garantida",
      "Condomínio R$ 1.700 empurra o total para R$ 4.943 (quase no teto)"
    ]
  },
  "quintoandar:895741950": {
    "modernityScore": 46,
    "modernityTier": "STANDARD",
    "visualWarnings": [
      "Auditoria visual (Reserva do Parque, Buritis): padrão econômico tipo MCMV — cerâmica pequena com rejunte claro, cozinha mínima (pia de bancada com 2 módulos), quartos minúsculos com piso laminado barato, parede com marcas de umidade/poeira",
      "Térreo com 'área privativa' cimentada/gramada murada com cerca concertina — NÃO é varanda; sem AC; sem vista",
      "Construído em 2020 mas acabamento básico: bônus de ano não reflete a qualidade"
    ]
  },
  "zapimoveis:2695763092": {
    "modernityScore": 50,
    "modernityTier": "STANDARD",
    "falseAC": true,
    "furnishedTier": "FULLY_FURNISHED",
    "visualWarnings": [
      "Auditoria visual: flat mobiliado (sofá-cama, geladeira, cama com TV, mesa) com ar-condicionado de JANELA (aparelho antigo na parede) — não é split",
      "Cozinha americana em laminado amarelo anos 90/2000, piso laminado, portas de madeira escura; flat com serviços inclusos (arrumação 3x/sem, manobrista) — perfil de apart-hotel",
      "Anúncio 'alugo e vendo' (também à venda); área anunciada 45 m² no texto vs 42 m² no portal"
    ]
  },
  "zapimoveis:2904295599": {
    "modernityScore": 50,
    "modernityTier": "STANDARD",
    "visualWarnings": [
      "Auditoria visual (Rua dos Aimorés): prédio antigo — arcos nas portas, portas de madeira escura antigas, esquadrias de alumínio com basculante dando para parede vizinha, cerâmica bege antiga, lobby com ardósia; só o banheiro foi renovado (cuba de apoio, porcelanato marmorizado)",
      "Portaria 12h (não 24h); 2º andar; sem AC; unidade vendida como mobiliada (mobília usada de sofá-cama + mesa de canto) mas portal indica sem mobília"
    ]
  },
  "zapimoveis:2907923825": {
    "modernityScore": 62,
    "modernityTier": "STANDARD",
    "verifiedBalcony": false,
    "visualWarnings": [
      "Auditoria visual (Rua Alagoas 1421): prédio de ~7 anos, piso de granito polido na sala/cozinha e laminado nos quartos, cozinha planejada branca com bancada preta, armários de correr; ventiladores de teto, sem AC",
      "'Área privativa' é pátio/terraço descoberto-coberto com pia, cercado por muro alto (sem vista) — aparenta ser pavimento baixo (andar não informado); janelas dos quartos para vizinhos"
    ]
  },
  "zapimoveis:2910959618": {
    "modernityScore": 72,
    "modernityTier": "WELL_MAINTAINED",
    "falseGourmet": true,
    "visualWarnings": [
      "Auditoria visual (Taquaral, Campinas): cozinha e guarda-roupas planejados, banheiro com porcelanato marmorizado, piso laminado escuro nos quartos/sala; sacada simples com guarda-corpo (sem churrasqueira/gourmet na unidade); sem AC visível",
      "Vista aberta sobre telhados baixos, com torres ao fundo (6º andar de 15)"
    ]
  },
  "quintoandar:895156464": {
    "modernityScore": 72,
    "modernityTier": "WELL_MAINTAINED",
    "verifiedBalcony": false,
    "visualWarnings": [
      "Auditoria visual (Parque Burle Marx, Buritis): reforma recente — piso porcelanato marmorizado, cozinha com armários brancos e bancada de granito, banheiro novo; cômodos pequenos (3 quartos em 65 m²)",
      "'Varanda da Sala' é um alcôve envidraçado pequeno voltado a lote vazio com subestação elétrica; sem AC; sofá e mesa nas fotos (provável staging, texto diz sem mobília)"
    ]
  },
  "quintoandar:893910191": {
    "modernityScore": 42,
    "modernityTier": "DATED",
    "falseAC": true,
    "falseGourmet": true,
    "furnishedTier": "FULLY_FURNISHED",
    "visualWarnings": [
      "Auditoria visual (Chateau d'Avignon, Icaraí): cozinha com piso preto polido e faixa decorativa antiga, banheiro com azulejo bege pequeno e armário de madeira escura antigo, piso de tábua corrida desgastado, janelas com grade",
      "AC apenas de janela (aparelho antigo no quarto); sem split visível; sem varanda nas fotos — 'varanda gourmet' e 'piscina privativa' do checklist não se sustentam",
      "Vista sobre telhados e torres vizinhas — não livre/definitiva garantida"
    ]
  },
  "zapimoveis:2916382982": {
    "modernityScore": 55,
    "modernityTier": "STANDARD",
    "verifiedBalcony": true,
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "visualWarnings": [
      "Auditoria visual: piso de quartos em cerâmica antiga amarelada, portas de madeira escura, hall em ardósia escura e esquadrias de alumínio; apto sem split visível",
      "3º andar de 10, em frente ao Corpo de Bombeiros (ruído de sirene) e próximo a Afonso Pena/Contorno"
    ]
  },
  "quintoandar:894844236": {
    "modernityScore": 78,
    "modernityTier": "WELL_MAINTAINED",
    "verifiedAC": true,
    "floorHint": "LOW",
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "visualWarnings": [
      "Auditoria visual: acabamento simples de construtora (porcelanato bege, paredes brancas, janelas pequenas); térreo–3º andar com janelas ao nível de árvores/calçada; sem portaria 24h"
    ]
  },
  "quintoandar:895752894": {
    "modernityScore": 52,
    "modernityTier": "STANDARD",
    "verifiedBalcony": true,
    "floorHint": "LOW",
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "visualWarnings": [
      "Auditoria visual: prédio anos 90 — cerâmica bege com rejunte escuro, granito bege, armários de madeira escura, ventilador de teto; AC só aparece como aparelho de janela em um quarto (sem split)",
      "Térreo–3º andar; condomínio R$1.080 alto para a idade; piscina pequena tipo plunge"
    ]
  },
  "quintoandar:895756139": {
    "modernityScore": 40,
    "modernityTier": "DATED",
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "visualWarnings": [
      "Auditoria visual: piso de taco/parquê escuro, paredes texturizadas, armários de madeira escura, azulejo 15x15 e cozinha branca antiga; prédio de ~4 pavimentos sem elevador aparente",
      "Descrição do anúncio é boilerplate de venda ('Apartamento à venda'); sem AC visível"
    ]
  },
  "zapimoveis:2902255224": {
    "modernityScore": 64,
    "modernityTier": "STANDARD",
    "verifiedAC": true,
    "falseGourmet": true,
    "verifiedBalcony": true,
    "floorHint": "HIGH",
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "visualWarnings": [
      "Auditoria visual: split na sala, varanda estreita com tela em andar alto (vista aberta sobre casas), apto vazio; 'varanda gourmet' não confirmada (varanda comum sem churrasqueira); banheiro social com prateleiras abertas sem gabinete"
    ]
  },
  "zapimoveis:2909756626": {
    "modernityScore": 62,
    "modernityTier": "STANDARD",
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "visualWarnings": [
      "Auditoria visual: porcelanato polido, cozinha branca com granito preto e armário de madeira escura nos quartos; sem AC visível; condomínio R$1.139 alto para 54 m²"
    ]
  },
  "quintoandar:895311175": {
    "modernityScore": 40,
    "modernityTier": "DATED",
    "falseAC": true,
    "furnishedTier": "FULLY_FURNISHED",
    "hasMaintenanceIssue": false,
    "visualWarnings": [
      "Auditoria visual (Ed. São Paulo, 1986): taco escuro, armários de madeira laranja/rosa dos anos 80, granito, hall em ardósia escura; apto MOBILIADO (sofá, mesa de jantar, cama, micro-ondas, geladeira, painel TV); sem split visível"
    ]
  },
  "zapimoveis:2897812497": {
    "modernityScore": 86,
    "modernityTier": "MODERN_OR_RENOVATED",
    "verifiedAC": true,
    "verifiedBalcony": true,
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "visualWarnings": [
      "Auditoria visual (Mandarim Patriani): studio-like 41 m² (sala+quarto integrados), semi-mobiliado só com cama, geladeira, micro-ondas e cooktop; sem sofá"
    ]
  },
  "zapimoveis:2894993578": {
    "modernityScore": 45,
    "modernityTier": "DATED",
    "falseAC": true,
    "furnishedTier": "FULLY_FURNISHED",
    "hasMaintenanceIssue": false,
    "visualWarnings": [
      "Auditoria visual: unidade de flat/apart-hotel (frigobar, micro-ondas, mobília de hotel, piso laminado, granito preto) com AC de janela, sem split",
      "Condomínio R$1.590 inclui serviços de hotelaria; possível uso de curta temporada"
    ]
  },
  "zapimoveis:2906266636": {
    "modernityScore": 68,
    "modernityTier": "WELL_MAINTAINED",
    "verifiedAC": true,
    "verifiedBalcony": true,
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "visualWarnings": [
      "Auditoria visual: split na sala e varanda envidraçada com condensadora; piso laminado, armários planejados; cozinha mista (madeira escura + granito) levemente datada",
      "Descrição diz 'APARTAMENTO À VENDA' — confirmar se é anúncio de aluguel válido"
    ]
  },
  "zapimoveis:2916590352": {
    "modernityScore": 38,
    "modernityTier": "DATED",
    "visualWarnings": [
      "Acabamentos datados nas fotos (AI visual estimate); engine STANDARD/62 too generous"
    ]
  },
  "zapimoveis:2904858701": {
    "modernityScore": 78,
    "modernityTier": "MODERN_OR_RENOVATED",
    "floorHint": "LOW",
    "visualWarnings": [
      "Mesmo prédio (Rua Padre Vieira 685) que o rank 130 — possível duplicata/mesma construtora",
      "Fotos mostram cozinha e banheiro sem armários, embora a descrição prometa armário embutido",
      "Mesmo prédio (faixa vermelha, Rua Padre Vieira) dos ranks 15 e 130"
    ]
  },
  "quintoandar:894735306": {
    "modernityScore": 82,
    "modernityTier": "MODERN_OR_RENOVATED",
    "verifiedBalcony": true,
    "floorHint": "LOW",
    "visualWarnings": [
      "Varanda com bancada/pia voltada para a mata; andar baixo (1º–3º)"
    ]
  },
  "zapimoveis:2911957866": {
    "modernityScore": 45,
    "modernityTier": "DATED",
    "verifiedAC": true,
    "floorHint": "HIGH",
    "visualWarnings": [
      "Piso cerâmico bege e azulejos brancos pequenos em toda a unidade; armários cor mel anos 2000",
      "Splits visíveis na sala e em 2 quartos (motor dá 0 pts de AC)"
    ]
  },
  "quintoandar:895107999": {
    "modernityScore": 35,
    "modernityTier": "DATED",
    "verifiedAC": true,
    "furnishedTier": "FULLY_FURNISHED",
    "visualWarnings": [
      "Acabamentos datados (AI visual estimate)"
    ]
  },
  "quintoandar:895122863": {
    "modernityScore": 78,
    "modernityTier": "WELL_MAINTAINED",
    "floorHint": "HIGH",
    "furnishedTier": "UNFURNISHED"
  },
  "quintoandar:895647320": {
    "modernityScore": 85,
    "modernityTier": "MODERN_OR_RENOVATED",
    "falseFreeView": true,
    "verifiedBalcony": true,
    "floorHint": "LOW",
    "furnishedTier": "UNFURNISHED",
    "visualWarnings": [
      "Vista da varanda dá para piscina e torres vizinhas: não é vista livre",
      "Varanda gourmet real com churrasqueira embutida",
      "Unidade vazia (motor alerta 'mobiliado' indevidamente)"
    ]
  },
  "zapimoveis:2909471621": {
    "modernityScore": 30,
    "modernityTier": "DATED",
    "falseAC": false,
    "verifiedAC": false,
    "floorHint": "HIGH",
    "furnishedTier": "UNFURNISHED",
    "hardExcludeDated": true,
    "visualWarnings": [
      "Auditoria visual: acabamento anos 80/90 — piso cerâmico bege claro com rejunte escuro, banheiro com azulejo bege estampado e louça cor de laranja/caramelo, esquadrias de alumínio com tela de proteção, armários brancos simples",
      "Sem ar-condicionado visível em nenhum cômodo",
      "Vaga em pátio descoberto; sem portaria 24h (só portão eletrônico/interfone)"
    ]
  },
  "quintoandar:893597870": {
    "modernityScore": 55,
    "modernityTier": "STANDARD",
    "falseAC": false,
    "verifiedAC": false,
    "verifiedBalcony": false,
    "furnishedTier": "UNFURNISHED",
    "visualWarnings": [
      "Auditoria visual (Raja Residence, flat): unidade tipo studio/flat de 40 m² com piso cerâmico bege, esquadrias de alumínio, bancada de granito e cozinha integrada simples — não é reformado",
      "Quarto com espuma acústica preta na parede; mobília parcial (cama box, geladeira, bancos) mas sem sofá",
      "Varanda é apenas porta de vidro com cortina para sacadinha mínima; sem AC (portal AR_CONDICIONADO=NAO)",
      "Av. Raja Gabaglia: tráfego intenso; condomínio R$ 933 de flat com lazer pesado"
    ]
  },
  "zapimoveis:2894697980": {
    "modernityScore": 62,
    "modernityTier": "STANDARD",
    "falseAC": false,
    "verifiedAC": false,
    "verifiedBalcony": true,
    "furnishedTier": "UNFURNISHED",
    "visualWarnings": [
      "Auditoria visual (Cond. Costa Azul): piso vinílico novo, mas cozinha e banheiro com azulejo anos 2000 com faixa decorativa, esquadrias com moldura de madeira escura, armários brancos simples",
      "Sem split visível; sala só com ventilador de teto",
      "Portal também lista imóvel à venda (R$ 495.000)"
    ]
  },
  "zapimoveis:2894838518": {
    "modernityScore": 88,
    "modernityTier": "MODERN_OR_RENOVATED",
    "falseAC": false,
    "verifiedAC": false,
    "falseFreeView": false,
    "verifiedBalcony": true,
    "floorHint": "HIGH",
    "furnishedTier": "UNFURNISHED",
    "visualWarnings": [
      "Auditoria visual (NOW Taquaral / Urban Design): unidade nova — piso vinílico amadeirado, marcenaria branca com nichos de madeira, esquadrias pretas, banheiro/lavabo modernos",
      "Varanda privativa com guarda-corpo metálico e vista livre sobre bairro (andar alto)",
      "AC: só preparação/laje técnica — nenhum split instalado; Imóvel também à venda (R$ 700.000); IPTU 'Isento' no portal"
    ]
  },
  "zapimoveis:2909508720": {
    "modernityScore": 72,
    "modernityTier": "WELL_MAINTAINED",
    "falseAC": false,
    "verifiedAC": true,
    "falseFreeView": true,
    "furnishedTier": "FULLY_FURNISHED",
    "visualWarnings": [
      "Auditoria visual: unidade de 35 m² com fotos MOBILIADAS (sofá-cama, TV, cama box, geladeira, mesa/bancada de trabalho) embora o portal diga 'não mobiliado' — aviso 'imagens podem ser da unidade decorada'",
      "Split instalado no quarto (visível)",
      "Vista: janela da sala dá para prédios vizinhos a curta distância — não é vista livre (PANORAMIC_VIEW do portal não confere)"
    ]
  },
  "quintoandar:895350968": {
    "modernityScore": 48,
    "modernityTier": "STANDARD",
    "falseAC": false,
    "verifiedAC": true,
    "verifiedBalcony": false,
    "furnishedTier": "FULLY_FURNISHED",
    "visualWarnings": [
      "Auditoria visual (Square Apart Hotel): apart-hotel mobiliado — piso cerâmico bege, azulejo branco 20x30, kitchenette com geladeira pequena/bancada preta, móveis básicos de hotel",
      "AC pequeno de parede no quarto (portal AC=SIM)",
      "Sem varanda (portal VARANDA=NAO); vista da sala para área verde/prédios"
    ]
  },
  "zapimoveis:2914132392": {
    "modernityScore": 25,
    "modernityTier": "DATED",
    "falseAC": false,
    "verifiedAC": false,
    "verifiedBalcony": true,
    "floorHint": "HIGH",
    "furnishedTier": "UNFURNISHED",
    "hardExcludeDated": true,
    "visualWarnings": [
      "Auditoria visual: piso de ardósia/pedra escura em todos os cômodos, roupeiros de madeira velha, esquadrias de alumínio, cozinha com azulejo 10x10 branco com rejunte cinza e lavatório de coluna na área de serviço, banheiros com revestimento antigo",
      "Sem AC visível",
      "Vista aberta sobre telhados (8º andar), com sacada"
    ]
  },
  "quintoandar:895777924": {
    "modernityScore": 70,
    "modernityTier": "WELL_MAINTAINED",
    "falseAC": false,
    "verifiedAC": true,
    "furnishedTier": "UNFURNISHED",
    "visualWarnings": [
      "Anúncio SUSPENSO no QuintoAndar (status 'suspenso', página 404/indisponível) — engine ainda marca ativo",
      "Fotos mostram apartamento habitado (móveis do morador); portal hasFurniture=false",
      "Split visível no quarto; marcenaria cinza/granito preto; vista de copas de árvores (andar 4–7)"
    ]
  },
  "zapimoveis:2908192129": {
    "modernityScore": 74,
    "modernityTier": "WELL_MAINTAINED",
    "falseFreeView": false,
    "verifiedBalcony": true,
    "floorHint": "MID",
    "furnishedTier": "UNFURNISHED",
    "visualWarnings": [
      "Auditoria visual (Cond. Invite Taquaral): prédio novo, piso laminado amadeirado, esquadrias claras, roupeiros brancos, banheiro branco/granito, cooktop",
      "Sacada com guarda-corpo metálico e vista aberta sobre telhados e torres — vista livre",
      "AC: não verificado (nenhum split visível nos cômodos); imóvel também à venda (R$ 650.000)"
    ]
  },
  "quintoandar:895726315": {
    "modernityScore": 74,
    "modernityTier": "WELL_MAINTAINED",
    "falseAC": false,
    "verifiedAC": false,
    "falseFreeView": false,
    "verifiedBalcony": false,
    "furnishedTier": "UNFURNISHED",
    "visualWarnings": [
      "Auditoria visual (Mirante Sion): unidade vazia, porcelanato bege grande, cozinha branca com granito preto, banheiros com box de vidro; vista panorâmica de BH e montanhas pelas janelas amplas da sala",
      "Sem AC (portal AC=NAO) e sem varanda (VARANDA=NAO); sem portaria 24h",
      "Preço no portal caiu para R$ 3.400 + 700 → total R$ 4.486 (snapshot 4.769)"
    ]
  },
  "vivareal:2881668073": {
    "modernityScore": 78,
    "modernityTier": "WELL_MAINTAINED",
    "verifiedBalcony": true,
    "furnishedTier": "UNFURNISHED",
    "visualWarnings": [
      "Sem split instalado nas fotos (sala/quarto); apto vazio e novo, sem armários de cozinha superiores além da bancada baixa"
    ]
  },
  "zapimoveis:2863123181": {
    "modernityScore": 85,
    "modernityTier": "MODERN_OR_RENOVATED",
    "verifiedAC": true,
    "verifiedBalcony": true,
    "furnishedTier": "FULLY_FURNISHED",
    "visualWarnings": [
      "Studio integrado (cama na sala); fotos mostram geladeira, sofá, cama, mesa e máquina de lavar - confirmar se é entregue mobiliado"
    ]
  },
  "quintoandar:895478867": {
    "modernityScore": 28,
    "modernityTier": "DATED",
    "falseAC": true,
    "falseFreeView": true,
    "noCabinets": false,
    "floorHint": "MID",
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "hardExcludeDated": true,
    "visualWarnings": [
      "Velharia: taco/madeira escura, roupeiros marrom escuro anos 90, cozinha com azulejo 15x15 e armário laminado branco, sem AC",
      "Vista para estacionamento/jardim do prédio vizinho, não é vista livre"
    ]
  },
  "zapimoveis:2869122432": {
    "modernityScore": 66,
    "modernityTier": "STANDARD",
    "falseAC": true,
    "verifiedBalcony": true,
    "floorHint": "LOW",
    "furnishedTier": "UNFURNISHED",
    "visualWarnings": [
      "Sem AC instalado: anúncio diz que o proprietário 'coloca o ar condicionado e desconta no aluguel'",
      "Imóvel também à venda"
    ]
  },
  "zapimoveis:2909596719": {
    "modernityScore": 62,
    "modernityTier": "STANDARD",
    "verifiedAC": true,
    "verifiedBalcony": true,
    "floorHint": "LOW",
    "furnishedTier": "UNFURNISHED",
    "visualWarnings": [
      "Térreo/1º andar de frente para avenida de tráfego intenso",
      "'Reformado' é cosmético: laminado, azulejo bege nos banheiros/serviço, mosaico de pastilhas"
    ]
  },
  "quintoandar:110311508": {
    "modernityScore": 74,
    "modernityTier": "WELL_MAINTAINED",
    "falseAC": true,
    "verifiedBalcony": true,
    "floorHint": "MID",
    "furnishedTier": "UNFURNISHED",
    "visualWarnings": [
      "AC no quarto é de janela/parede (caixa), não split",
      "Cozinha americana reformada com forno/cooktop; varanda com vista aberta"
    ]
  },
  "zapimoveis:2907915920": {
    "modernityScore": 50,
    "modernityTier": "STANDARD",
    "furnishedTier": "UNFURNISHED",
    "visualWarnings": [
      "Piso em granito cinza (não porcelanato) em toda a área social, laminado nos quartos",
      "Sem AC e sem varanda nas fotos; 9º andar é o último do prédio, mas não cobertura"
    ]
  },
  "quintoandar:895233806": {
    "modernityScore": 78,
    "modernityTier": "MODERN_OR_RENOVATED",
    "verifiedAC": true,
    "verifiedBalcony": true,
    "furnishedTier": "FULLY_FURNISHED",
    "visualWarnings": [
      "Texto de anúncio inicia com 'VENDA PORTEIRA FECHADA' - pode estar também à venda"
    ]
  },
  "quintoandar:151248098": {
    "modernityScore": 55,
    "modernityTier": "STANDARD",
    "falseAC": true,
    "floorHint": "MID",
    "furnishedTier": "UNFURNISHED",
    "visualWarnings": [
      "Checklist marca AC mas sala e 2 quartos não têm split nem espera de ar; sem varanda",
      "Piso em granito/mármore polido na sala e laminado nos quartos; cozinha pequena e branca com bancada de granito"
    ]
  },
  "zapimoveis:2916725156": {
    "modernityScore": 86,
    "modernityTier": "MODERN_OR_RENOVATED",
    "verifiedAC": true,
    "furnishedTier": "UNFURNISHED",
    "visualWarnings": [
      "Layout aberto tipo studio: cozinha americana, sala e espaço de cama no mesmo salão (quarto separado não aparece nas fotos)"
    ]
  },
  "zapimoveis:2906900135": {
    "modernityScore": 60,
    "modernityTier": "STANDARD",
    "floorHint": "HIGH"
  },
  "quintoandar:117660077": {
    "modernityScore": 32,
    "modernityTier": "DATED",
    "furnishedTier": "FULLY_FURNISHED",
    "visualWarnings": [
      "Auditoria visual: flat/apto antigo, acabamentos datados; 'Novo/Reformado' do QuintoAndar não se confirma nas fotos; mobília aparece nas fotos apesar de 'não mobiliado'"
    ]
  },
  "quintoandar:895164722": {
    "modernityScore": 62,
    "modernityTier": "STANDARD",
    "verifiedBalcony": true,
    "floorHint": "MID"
  },
  "zapimoveis:2916859442": {
    "modernityScore": 40,
    "modernityTier": "DATED",
    "floorHint": "HIGH",
    "visualWarnings": [
      "Auditoria visual: acabamentos datados; sem split visível; layout sala/dormitório apertado"
    ]
  },
  "zapimoveis:2910045895": {
    "modernityScore": 45,
    "modernityTier": "DATED",
    "floorHint": "LOW",
    "furnishedTier": "FULLY_FURNISHED",
    "visualWarnings": [
      "Auditoria visual: unidade tipo loft/mezanino em térreo, mobília nas fotos, descrição com texto de venda"
    ]
  },
  "quintoandar:895219206": {
    "modernityScore": 28,
    "modernityTier": "DATED",
    "floorHint": "LOW",
    "hasMaintenanceIssue": true,
    "visualWarnings": [
      "Auditoria visual: acabamentos antigos (cerâmica, armários creme, azulejo estampado), paredes manchadas/descascando (infiltração), estacionamento coberto aberto, andar 0–3; flag 'Novo/Reformado' não confirmada; também à venda (R$ 410k)"
    ]
  },
  "imovelweb:3034841571": {
    "modernityScore": 66,
    "modernityTier": "WELL_MAINTAINED",
    "verifiedAC": true,
    "floorHint": "HIGH"
  },
  "zapimoveis:2902187963": {
    "modernityScore": 80,
    "modernityTier": "MODERN_OR_RENOVATED",
    "verifiedAC": true,
    "verifiedBalcony": true,
    "floorHint": "HIGH"
  },
  "zapimoveis:2903712357": {
    "modernityScore": 60,
    "modernityTier": "STANDARD",
    "falseGourmet": false,
    "noCabinets": false,
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "visualWarnings": [
      "Auditoria visual: sem ar-condicionado visível (só ventilador de teto no quarto; gás/aquecedor na lavanderia); acabamento padrão MRV-like (piso laminado claro, armários brancos, bancada granito)"
    ]
  },
  "quintoandar:125324513": {
    "modernityScore": 76,
    "modernityTier": "WELL_MAINTAINED",
    "verifiedAC": false,
    "falseFreeView": false,
    "noCabinets": false,
    "floorHint": "MID",
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "visualWarnings": [
      "Auditoria visual: apto reformado (piso vinílico/laminado claro, cozinha nova com cooktop, banheiro novo, forro de gesso/LED) em prédio antigo dos anos 70/80 com hall escuro; sem split (só ventilador de teto)"
    ]
  },
  "zapimoveis:2912894953": {
    "modernityScore": 40,
    "modernityTier": "DATED",
    "verifiedAC": true,
    "falseGourmet": false,
    "noCabinets": false,
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "visualWarnings": [
      "Auditoria visual: apto anos 90 — piso de madeira escura/taco e cerâmica mosaico antiga na copa/varanda, armários de madeira escura (roupeiro veneziana), granito verde no banheiro; split instalado na sala"
    ]
  },
  "quintoandar:894603358": {
    "modernityScore": 84,
    "modernityTier": "MODERN_OR_RENOVATED",
    "verifiedAC": true,
    "falseGourmet": false,
    "falseFreeView": false,
    "verifiedBalcony": true,
    "noCabinets": false,
    "floorHint": "HIGH",
    "furnishedTier": "FULLY_FURNISHED",
    "hasMaintenanceIssue": false,
    "visualWarnings": [
      "Auditoria visual: studio de 40 m² mobiliado (sofá, TV, cama nova, geladeira, cooktop); split na sala; varanda com guarda-corpo de vidro; prédio novo com coworking/lavanderia/piscina"
    ]
  },
  "quintoandar:130666021": {
    "modernityScore": 86,
    "modernityTier": "MODERN_OR_RENOVATED",
    "falseAC": false,
    "verifiedAC": false,
    "falseGourmet": false,
    "falseFreeView": false,
    "noCabinets": false,
    "floorHint": "MID",
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "visualWarnings": [
      "Auditoria visual: prédio novo (rooftop com piscina, academia, coworking-like), piso porcelanato grande, esquadrias pretas, marcenaria em ripado/freijó, banheiro novo; sem split instalado e sem varanda visível; layout compacto 44 m² quase studio com divisória ripada"
    ]
  },
  "quintoandar:895686444": {
    "modernityScore": 55,
    "modernityTier": "STANDARD",
    "falseAC": false,
    "falseGourmet": false,
    "falseFreeView": false,
    "noCabinets": false,
    "floorHint": "MID",
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "visualWarnings": [
      "Auditoria visual: apto anos 2000 — cozinha com bancada de granito preto e armário de vidro preto, azulejo branco liso em toda parte, portas de madeira laranja, piso laminado; sem AC; portaria virtual (não 24h presencial); 2 vagas em linha (uma atrás da outra)"
    ]
  },
  "zapimoveis:2911096715": {
    "modernityScore": 44,
    "modernityTier": "DATED",
    "falseAC": false,
    "falseGourmet": false,
    "falseFreeView": false,
    "noCabinets": false,
    "floorHint": "HIGH",
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "visualWarnings": [
      "Auditoria visual: acabamento original anos 90 — piso de tábua/taco envernizado, azulejo 15x15 branco com rejunte cinza, roupeiros de madeira antiga, granito; sem AC; prédio ao lado de hospital Unimed (ruído de ambulâncias, estimativa)"
    ]
  },
  "zapimoveis:2914962140": {
    "modernityScore": 22,
    "modernityTier": "DATED",
    "falseAC": false,
    "falseGourmet": false,
    "falseFreeView": false,
    "noCabinets": false,
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "visualWarnings": [
      "Auditoria visual: apto anos 80 — ardósia/pedra escura na sala, taco nos quartos, estante e roupeiros de madeira laranja, azulejo 15x15 branco com rejunte cinza, cuba de bancada bege antiga, ventilador de teto, sem AC"
    ]
  },
  "quintoandar:895785541": {
    "modernityScore": 72,
    "modernityTier": "WELL_MAINTAINED",
    "falseAC": false,
    "falseGourmet": false,
    "falseFreeView": false,
    "verifiedBalcony": false,
    "noCabinets": false,
    "floorHint": "LOW",
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "visualWarnings": [
      "Auditoria visual: prédio de 2021 padrão econômico (MRV-like) — piso laminado, azulejo metrô branco, roupeiro com espelho, sem AC; térreo/1º–3º andar; vagas descobertas com tela sombreadora"
    ]
  },
  "zapimoveis:2914411635": {
    "modernityScore": 44,
    "modernityTier": "DATED",
    "falseAC": false,
    "falseGourmet": true,
    "falseFreeView": false,
    "noCabinets": false,
    "floorHint": "HIGH",
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "visualWarnings": [
      "Auditoria visual: apto anos 90 — piso cerâmico bege 40x40, roupeiros de madeira escura, granito, azulejo 15x15 branco na área de serviço, sanca de gesso antiga, ventilador de teto (sem AC); 'varanda gourmet' é uma varanda comum telada sem bancada/churrasqueira"
    ]
  },
  "zapimoveis:2880962287": {
    "modernityScore": 25,
    "modernityTier": "DATED",
    "falseAC": true,
    "furnishedTier": "FULLY_FURNISHED",
    "hardExcludeDated": true,
    "visualWarnings": [
      "Auditoria visual: flat anos 90 com mobília datada, ventilador de teto e sem split",
      "Mobiliado (sofá, cama, geladeira vistos) mas o engine pontuou como UNFURNISHED (+15 em vez de -22)"
    ]
  },
  "quintoandar:895627704": {
    "modernityScore": 82,
    "modernityTier": "MODERN_OR_RENOVATED",
    "verifiedAC": true,
    "visualWarnings": [
      "Foto rotulada Varanda mostra gramado e blocos baixos (padrão MCMV), incoerente com torre moderna do Cambuí: possível foto de outra unidade; vizinho muito próximo pela janela da sala"
    ]
  },
  "zapimoveis:2865685677": {
    "modernityScore": 15,
    "modernityTier": "DATED",
    "falseAC": true,
    "hardExcludeDated": true,
    "visualWarnings": [
      "Auditoria visual: louça sanitária marrom, piso/azulejo anos 70, armário de alumínio bruto, sem AC, só interfone"
    ]
  },
  "zapimoveis:2914125057": {
    "modernityScore": 30,
    "modernityTier": "DATED",
    "falseAC": true,
    "furnishedTier": "FULLY_FURNISHED",
    "hardExcludeDated": true,
    "visualWarnings": [
      "Auditoria visual: acabamentos datados, sem AC; texto cita portaria virtual enquanto amenity diz 24h"
    ]
  },
  "quintoandar:130832051": {
    "modernityScore": 70,
    "modernityTier": "WELL_MAINTAINED",
    "verifiedAC": true,
    "verifiedBalcony": true
  },
  "quintoandar:130531724": {
    "modernityScore": 72,
    "modernityTier": "WELL_MAINTAINED",
    "verifiedAC": true
  },
  "quintoandar:895004991": {
    "modernityScore": 48,
    "modernityTier": "STANDARD",
    "falseAC": true,
    "furnishedTier": "FULLY_FURNISHED",
    "hardExcludeDated": true,
    "visualWarnings": [
      "Falso reformado: móveis soltos e acabamento original; split não visível em 2 ângulos da sala e quarto apesar do texto",
      "AVCB em regularização segundo a descrição"
    ]
  },
  "zapimoveis:2912879032": {
    "modernityScore": 22,
    "modernityTier": "DATED",
    "falseAC": true,
    "hardExcludeDated": true,
    "visualWarnings": [
      "Piso de ardósia escura, cozinha com azulejo 15x15 de rejunte escuro, guarda-roupas de madeira antigos, banheiro anos 90",
      "Sem AC visível; vista apenas para prédio vizinho"
    ]
  },
  "quintoandar:123480155": {
    "modernityScore": 35,
    "modernityTier": "DATED",
    "verifiedAC": false,
    "noCabinets": false,
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "visualWarnings": [
      "Listing page now redirects to /indisponivel/ (unavailable) - remove from ranking",
      "Old reddish-brown wood wardrobes and kitchen/laundry wall cabinets",
      "Terracotta/old ceramic floors and floral-border wall tiles in kitchen, bath and laundry; brown ceramic sink/toilet",
      "No split AC visible in any photo",
      "Photo set includes a Street View screenshot, not unit photos"
    ]
  },
  "zapimoveis:2910733791": {
    "modernityScore": 35,
    "modernityTier": "DATED",
    "verifiedAC": false,
    "noCabinets": false,
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "visualWarnings": [
      "Old sinteco/parquet floors throughout",
      "Brown wood built-in wardrobes (old style)",
      "1960s-70s building facade, no visible leisure area",
      "No split AC visible",
      "Photos portrait/low-res; no living-room window view or balcony"
    ]
  },
  "zapimoveis:2883543779": {
    "modernityScore": 62,
    "modernityTier": "STANDARD",
    "verifiedAC": false,
    "falseGourmet": false,
    "furnishedTier": "UNFURNISHED",
    "visualWarnings": [
      "Beige large-format ceramic floors, planned kitchen with mixed wood/white cabinets: standard not modern",
      "No split AC (white overhead cabinet in living photo is a cabinet, not AC)"
    ]
  },
  "zapimoveis:2900994010": {
    "modernityScore": 40,
    "modernityTier": "DATED",
    "falseGourmet": true,
    "furnishedTier": "FULLY_FURNISHED",
    "visualWarnings": [
      "Studio-like 'quarto e sala' layout: kitchen, dining, sofa-bed and bed in open plan",
      "Old orange/honey wood furniture and cabinet (1990s flat style)",
      "Small window-type openings; no split AC visible in photos (text claims AC)",
      "Coin-operated laundry (R$17 wash / R$17 dry)",
      "No private gourmet balcony visible; the terrace in photos is a shared rooftop"
    ]
  },
  "zapimoveis:2692105460": {
    "modernityScore": 55,
    "modernityTier": "STANDARD",
    "verifiedAC": false,
    "furnishedTier": "FULLY_FURNISHED",
    "visualWarnings": [
      "Only ceiling fans in bedroom; split AC not visible in any photo (listed in text/amenities)",
      "Small glassed sacada integrated to kitchen with stove on it",
      "Small fridge, compact kitchenette (flat-like)"
    ]
  },
  "zapimoveis:2915216352": {
    "modernityScore": 80,
    "modernityTier": "MODERN_OR_RENOVATED",
    "verifiedAC": true,
    "verifiedBalcony": true,
    "furnishedTier": "FULLY_FURNISHED",
    "visualWarnings": [
      "Photos look decorated/staged (possible developer showroom or virtual staging); two photos are duplicates",
      "Split AC visible above bedroom window",
      "Tower lifestyle amenities (lap pool, gym, gourmet space) from condo, not unit"
    ]
  },
  "zapimoveis:2845205822": {
    "modernityScore": 45,
    "modernityTier": "DATED",
    "furnishedTier": "FULLY_FURNISHED",
    "hasMaintenanceIssue": false,
    "visualWarnings": [
      "Exposed concrete ceiling/brick industrial retrofit with old window frames",
      "Old brown ceramic wash basin and toilet tank in WC",
      "Open kitchen/living/bed area, studio-like",
      "Possible split AC above fridge but not confirmable",
      "Furnished: sofa, bed, fridge, microwave seen (listing text: 100% mobiliado)"
    ]
  },
  "quintoandar:895340126": {
    "modernityScore": 55,
    "modernityTier": "STANDARD",
    "verifiedAC": false,
    "falseFreeView": false,
    "visualWarnings": [
      "Duplex/mezzanine layout with internal stairs (62 m² for 1 suite)",
      "Old light wood kitchen cabinets with granite counters and tile granite floors in service areas",
      "New herringbone parquet on upper level",
      "Photos from rooms are unfurnished; portal says 'mobiliado' - furnished tier unverified",
      "Photo sets from two sources (different watermarks)",
      "No split AC visible"
    ]
  },
  "zapimoveis:2898962280": {
    "modernityScore": 66,
    "modernityTier": "WELL_MAINTAINED",
    "verifiedAC": false,
    "verifiedBalcony": true,
    "floorHint": "MID",
    "furnishedTier": "UNFURNISHED",
    "visualWarnings": [
      "No split AC visible",
      "Listing also advertised for sale",
      "Open view from 5th floor balcony over low-rise"
    ]
  },
  "quintoandar:130305596": {
    "modernityScore": 58,
    "modernityTier": "STANDARD",
    "verifiedAC": true,
    "furnishedTier": "UNFURNISHED",
    "visualWarnings": [
      "Split AC visible in suite photo",
      "Duplex with steep internal stairs",
      "Dark red-brown wood floor (old style) and granite counters",
      "Live portal total R$5,010 exceeds R$5,000 cap",
      "Portal says ELEVADOR=NAO and PORTARIA_24H=NAO"
    ]
  },
  "netimoveis:788104": {
    "modernityScore": 38,
    "modernityTier": "DATED",
    "noCabinets": false,
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "visualWarnings": [
      "Auditoria visual: guarda-roupa de madeira escura antigo, piso cerâmico 15x15 claro com rodapé/sanca de madeira, banheiro com azulejo verde anos 90, cozinha antiga com bancada de madeira; sem ar-condicionado visível"
    ]
  },
  "quintoandar:151409534": {
    "modernityScore": 76,
    "modernityTier": "WELL_MAINTAINED",
    "verifiedAC": true,
    "verifiedBalcony": true,
    "noCabinets": false,
    "visualWarnings": [
      "Fotos mostram unidade mobiliada/em uso (mesa, TV, máquina de lavar, cama) embora o anúncio diga 'não mobiliado' — confirmar o que permanece"
    ]
  },
  "zapimoveis:2892289481": {
    "modernityScore": 70,
    "modernityTier": "WELL_MAINTAINED",
    "verifiedAC": true,
    "noCabinets": false,
    "floorHint": "LOW",
    "furnishedTier": "FULLY_FURNISHED",
    "visualWarnings": [
      "Descrição diz 'Mobiliado' e fotos mostram sala/jantar/TV/cozinha completos; 2º andar (baixo); anúncio sem atualização há ~2 meses (atualizado 18/08), preço no teto R$4.995"
    ]
  },
  "quintoandar:895562640": {
    "modernityScore": 76,
    "modernityTier": "MODERN_OR_RENOVATED",
    "falseFreeView": false,
    "noCabinets": true,
    "visualWarnings": [
      "Auditoria visual: unidade nova entregue em casca — cozinha só com bancada de granito (sem armários), banheiro sem armário, piso porcelanato cinza; quarto não aparece nas fotos (layout estilo studio/open space); sem AC; condomínio megacondomínio familiar"
    ]
  },
  "quintoandar:130103525": {
    "modernityScore": 72,
    "modernityTier": "WELL_MAINTAINED",
    "verifiedBalcony": true,
    "noCabinets": true,
    "visualWarnings": [
      "Auditoria visual: unidade vazia em casca — cozinha aberta só com bancada de granito preto (sem armários), piso laminado, sem AC instalado (apenas grelhas/pontos)"
    ]
  },
  "zapimoveis:2915112592": {
    "modernityScore": 42,
    "modernityTier": "DATED",
    "noCabinets": false,
    "hasMaintenanceIssue": false,
    "visualWarnings": [
      "Auditoria visual: piso de tábua corrida escura envelhecida, cozinha/área de serviço com azulejo branco 10x10 e armários de vidro antigos, banheiro com granito/lavatório antigo; sem ar-condicionado visível"
    ]
  },
  "zapimoveis:2909468746": {
    "modernityScore": 48,
    "modernityTier": "STANDARD",
    "verifiedBalcony": true,
    "noCabinets": false,
    "visualWarnings": [
      "Auditoria visual: piso cerâmico bege 30x30, esquadrias de alumínio cru, cozinha com azulejo branco 15x15 e granito antigo, paredes amareladas, sem ar-condicionado; região hospitalar"
    ]
  },
  "quintoandar:129415285": {
    "modernityScore": 60,
    "modernityTier": "STANDARD",
    "verifiedAC": true,
    "verifiedBalcony": true,
    "noCabinets": false,
    "floorHint": "HIGH",
    "furnishedTier": "FULLY_FURNISHED",
    "visualWarnings": [
      "Portal marca hasFurniture=true e fotos mostram unidade totalmente mobiliada (sofá, cama, TV, mesa); condomínio de R$1.555 sugere perfil flat/serviços; acabamento anos 2000 (cerâmica bege, madeira escura, splits antigos)"
    ]
  },
  "quintoandar:151767131": {
    "modernityScore": 76,
    "modernityTier": "WELL_MAINTAINED",
    "falseAC": true,
    "verifiedBalcony": true,
    "noCabinets": false,
    "floorHint": "MID",
    "visualWarnings": [
      "Auditoria visual: anúncio marca ar-condicionado mas não há Split instalado nas fotos (ventilador de teto na sala; quartos sem aparelho)"
    ]
  },
  "quintoandar:895396305": {
    "modernityScore": 72,
    "modernityTier": "WELL_MAINTAINED",
    "falseFreeView": true,
    "noCabinets": false,
    "furnishedTier": "FULLY_FURNISHED",
    "visualWarnings": [
      "Auditoria visual: varanda gourmet de frente para fachada de prédio vizinho a poucos metros (vista bloqueada); garagem descoberta com sombrite; acabamento padrão econômico (granito, laminado)"
    ]
  },
  "zapimoveis:2743063862": {
    "modernityScore": 62,
    "modernityTier": "STANDARD",
    "verifiedAC": true,
    "floorHint": "HIGH",
    "furnishedTier": "UNFURNISHED",
    "visualWarnings": [
      "Studio-like 1-quarto de 41 m²"
    ]
  },
  "quintoandar:895181066": {
    "modernityScore": 75,
    "modernityTier": "WELL_MAINTAINED",
    "verifiedAC": true,
    "floorHint": "HIGH",
    "furnishedTier": "FULLY_FURNISHED"
  },
  "zapimoveis:2909412921": {
    "modernityScore": 83,
    "modernityTier": "MODERN_OR_RENOVATED",
    "floorHint": "LOW",
    "visualWarnings": [
      "Mesmo prédio (Rua Padre Vieira 685) que o rank 123",
      "Mesma unidade do rank 15 (Rua Padre Vieira, 52 m², mesmos trilhos de luz, painel ripado e bancada): anunciada no QuintoAndar e no Zap com totais diferentes (QA R$ 4.332 vs Zap R$ 3.750)"
    ]
  },
  "zapimoveis:2905603741": {
    "modernityScore": 55,
    "modernityTier": "STANDARD",
    "verifiedAC": true,
    "furnishedTier": "FULLY_FURNISHED",
    "visualWarnings": [
      "Auditoria visual: janelas voltadas a prédio vizinho; mobília visível nas fotos"
    ]
  },
  "quintoandar:895163193": {
    "modernityScore": 75,
    "modernityTier": "WELL_MAINTAINED",
    "verifiedAC": true,
    "verifiedBalcony": true,
    "furnishedTier": "UNFURNISHED",
    "visualWarnings": [
      "Mobiliado parcial: sofá, geladeira, mesa e escrivaninha, mas nenhuma cama nas 4 fotos de quarto → UNFURNISHED pela regra de 2 níveis"
    ]
  }
};
