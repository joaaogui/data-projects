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
    "modernityScore": 79,
    "modernityTier": "MODERN_OR_RENOVATED",
    "verifiedAC": true,
    "falseFreeView": true,
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "hardExcludeDated": false,
    "visualWarnings": [
      "Tanque de coluna simples na lavanderia",
      "Piso granilite/cerâmico padrão na cozinha",
      "Auditoria visual: vista parcial — torre vizinha do mesmo condomínio bloqueia metade da vista da sala e da suíte",
      "Split confirmado apenas na suíte (quarto 1 sem AC)"
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
    "modernityScore": 92,
    "modernityTier": "MODERN_OR_RENOVATED",
    "verifiedAC": true,
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "hardExcludeDated": false,
    "visualWarnings": [
      "Apenas 1 split visível (suíte); sala e 2º quarto sem ar",
      "Perfil de megacondomínio familiar (brinquedoteca, playground, mini quadra, piscinas adulto/infantil, várias torres)"
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
    "modernityScore": 82,
    "modernityTier": "MODERN_OR_RENOVATED",
    "falseAC": true,
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "hardExcludeDated": false,
    "visualWarnings": [
      "Sem split de ar-condicionado visível nas paredes do apartamento",
      "Quartos sem armários embutidos visíveis nas fotos"
    ]
  },
  "zapimoveis:2878532384": {
    "modernityScore": 92,
    "modernityTier": "MODERN_OR_RENOVATED",
    "falseAC": true,
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "hardExcludeDated": false,
    "visualWarnings": [
      "Sem split de ar-condicionado visível nas fotos internas do apartamento"
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
    "falseAC": true,
    "falseGourmet": true,
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "hardExcludeDated": false,
    "visualWarnings": [
      "Sem split de ar-condicionado visível nas paredes",
      "Varanda envidraçada simples sem churrasqueira gourmet visível"
    ]
  },
  "quintoandar:895560013": {
    "modernityScore": 92,
    "modernityTier": "MODERN_OR_RENOVATED",
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "hardExcludeDated": false,
    "visualWarnings": [
      "Sem split instalado (provável nicho de condensadora na área de serviço)",
      "Cozinha sem cooktop/forno"
    ]
  },
  "zapimoveis:2892142503": {
    "modernityScore": 95,
    "modernityTier": "MODERN_OR_RENOVATED",
    "verifiedAC": true,
    "verifiedBalcony": true,
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "hardExcludeDated": false,
    "visualWarnings": [
      "Auditoria visual: Split instalado só na sala; quarto aparenta ter apenas preparação para AC"
    ]
  },
  "zapimoveis:2908131723": {
    "modernityScore": 86,
    "modernityTier": "MODERN_OR_RENOVATED",
    "verifiedAC": true,
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
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "hardExcludeDated": false,
    "visualWarnings": [
      "Auditoria visual: unidade nova (piso vinílico amadeirado, painel ripado com LED, cozinha planejada com forno/cooktop embutidos, banheiro em porcelanato grande); splits instalados na sala e no quarto; fotos vazias e portal 'Sem mobília', mas a descrição do proprietário diz 'mobiliado (geladeira, TVs, sofá, mesa)' — confirmar se os móveis saem"
    ]
  },
  "quintoandar:894145534": {
    "modernityScore": 86,
    "modernityTier": "MODERN_OR_RENOVATED",
    "verifiedAC": true,
    "floorHint": "LOW",
    "furnishedTier": "FULLY_FURNISHED",
    "hasMaintenanceIssue": false,
    "hardExcludeDated": false,
    "visualWarnings": [
      "Loft com suíte em mezanino aberto (guarda-corpo de vidro, sem porta) e escada flutuante interna",
      "3º andar voltado para a Rua Maria Monteiro (eixo comercial/boêmio: Oba, padaria 24h, posto em frente)",
      "Fotos de jul/2023; acabamento estilo ~2012 (pastilha de vidro, granito preto); split só no mezanino"
    ]
  },
  "zapimoveis:2903408622": {
    "modernityScore": 88,
    "modernityTier": "MODERN_OR_RENOVATED",
    "falseGourmet": true,
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "hardExcludeDated": false,
    "visualWarnings": [
      "Varanda privativa do apartamento é simples (churrasqueira nas fotos pertence à área comum do condomínio)"
    ]
  },
  "zapimoveis:2905000906": {
    "modernityScore": 88,
    "modernityTier": "MODERN_OR_RENOVATED",
    "falseAC": true,
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "hardExcludeDated": false,
    "visualWarnings": [
      "Edifício/fachada mais antigo (anos 90), porém interior 100% reformado",
      "Sem split de ar-condicionado visível nas fotos"
    ]
  },
  "zapimoveis:2906293013": {
    "modernityScore": 86,
    "modernityTier": "MODERN_OR_RENOVATED",
    "falseAC": true,
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "hardExcludeDated": false,
    "visualWarnings": [
      "Sem split de ar-condicionado visível no interior ou na fachada"
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
    "modernityScore": 90,
    "modernityTier": "MODERN_OR_RENOVATED",
    "furnishedTier": "FULLY_FURNISHED",
    "hasMaintenanceIssue": false,
    "hardExcludeDated": false,
    "visualWarnings": []
  },
  "quintoandar:895748989": {
    "modernityScore": 94,
    "modernityTier": "MODERN_OR_RENOVATED",
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "hardExcludeDated": false,
    "visualWarnings": []
  },
  "quintoandar:894618527": {
    "modernityScore": 68,
    "modernityTier": "WELL_MAINTAINED",
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "hardExcludeDated": false,
    "visualWarnings": [
      "Armários de quarto antigos em madeira avermelhada/mel com maleiro e puxadores bola (anos 90/2000)",
      "Piso laminado avermelhado antigo nos quartos",
      "Esquadrias antigas pintadas de escuro nos quartos"
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
    "modernityScore": 85,
    "modernityTier": "MODERN_OR_RENOVATED",
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "hardExcludeDated": false,
    "visualWarnings": []
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
    "modernityScore": 88,
    "modernityTier": "MODERN_OR_RENOVATED",
    "hasMaintenanceIssue": false,
    "hardExcludeDated": false,
    "visualWarnings": [
      "Loft duplex: escada interna e suíte em mezanino aberta para a sala (sem privacidade)",
      "Sem ar-condicionado Split visível em nenhum ambiente",
      "Banheiro com pastilhas de vidro (estilo anos 2000/2010) e chuveiro elétrico",
      "Portaria automatizada (biometria/app), sem porteiro"
    ]
  },
  "quintoandar:895722432": {
    "modernityScore": 95,
    "modernityTier": "MODERN_OR_RENOVATED",
    "falseAC": true,
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "hardExcludeDated": false,
    "visualWarnings": [
      "Auditoria visual: anúncio marca ar-condicionado mas não há Split instalado nas fotos (sala e 2 quartos vazios)"
    ]
  },
  "quintoandar:893127481": {
    "modernityScore": 100,
    "modernityTier": "MODERN_OR_RENOVATED",
    "verifiedAC": true,
    "noCabinets": true,
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "hardExcludeDated": false,
    "visualWarnings": [
      "Fotos de 2020 mostram cozinha sem armários (só bancada) e quarto sem guarda-roupa",
      "Fotos antigas (ago/2020) — estado atual não confirmado",
      "Entorno hospitalar (Hospital das Clínicas / Santa Casa / João XXIII a ~400 m): sirenes e fluxo intenso"
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
    "modernityScore": 68,
    "modernityTier": "WELL_MAINTAINED",
    "hasMaintenanceIssue": false,
    "hardExcludeDated": false,
    "visualWarnings": [
      "Piso de taco e tábua corrida antiga na sala e nos quartos",
      "Esquadrias de alumínio simples/antigas",
      "Interruptores, interfone e luminária globo antigos"
    ]
  },
  "quintoandar:895708603": {
    "modernityScore": 82,
    "modernityTier": "MODERN_OR_RENOVATED",
    "furnishedTier": "UNFURNISHED",
    "noCabinets": true,
    "hasMaintenanceIssue": false,
    "hardExcludeDated": false,
    "visualWarnings": [
      "Ausência total de armários na cozinha, banheiros e quartos (imóvel recém-entregue cru)",
      "Banheiros sem box, sem chuveiro instalado e sem espelho; sem luminárias (entrega padrão construtora)",
      "Varanda com bancada de granito e pia (gourmet sem churrasqueira)"
    ]
  },
  "zapimoveis:2907744516": {
    "modernityScore": 88,
    "modernityTier": "MODERN_OR_RENOVATED",
    "furnishedTier": "FULLY_FURNISHED",
    "hasMaintenanceIssue": false,
    "hardExcludeDated": false,
    "visualWarnings": []
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
    "modernityScore": 70,
    "modernityTier": "WELL_MAINTAINED",
    "falseAC": true,
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "hardExcludeDated": false,
    "visualWarnings": [
      "Armário do quarto em laminado tom mel/cerejeira estilo anos 2000",
      "Azulejos pequenos quadrados no box do banheiro e na cozinha",
      "Auditoria visual: ar-condicionado anunciado não confirmado nas fotos"
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
    "modernityScore": 70,
    "modernityTier": "WELL_MAINTAINED",
    "hasMaintenanceIssue": false,
    "hardExcludeDated": false,
    "visualWarnings": [
      "Azulejos quadrados 15x15 antigos na cozinha e na varanda",
      "Portas de madeira em estilo clássico com arco"
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
    "modernityScore": 82,
    "modernityTier": "MODERN_OR_RENOVATED",
    "floorHint": "HIGH",
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "hardExcludeDated": false,
    "visualWarnings": [
      "Esquadrias de alumínio natural originais na sala e no quarto (cozinha e banheiro totalmente reformados)"
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
    "modernityScore": 76,
    "modernityTier": "WELL_MAINTAINED",
    "furnishedTier": "UNFURNISHED",
    "hasMaintenanceIssue": false,
    "hardExcludeDated": false,
    "visualWarnings": []
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
    "modernityScore": 90,
    "modernityTier": "MODERN_OR_RENOVATED",
    "hasMaintenanceIssue": false,
    "hardExcludeDated": false,
    "visualWarnings": []
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
    "modernityScore": 90,
    "modernityTier": "MODERN_OR_RENOVATED",
    "furnishedTier": "FULLY_FURNISHED",
    "hasMaintenanceIssue": false,
    "hardExcludeDated": false,
    "visualWarnings": []
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
  }
};
