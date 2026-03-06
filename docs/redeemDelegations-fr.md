# Documentation : `redeemDelegations`

## En bref

La fonction `redeemDelegations` permet à un utilisateur (le **délégué**) d'exécuter des actions au nom d'un autre (le **délégant**), en utilisant des délégations signées. Elle vérifie que tout est conforme, puis exécute les actions demandées.

---

## Paramètres

| Paramètre | Description |
|-----------|--------------|
| `_permissionContexts` | Tableau de contextes de permission. Chaque élément contient une chaîne de délégations (du plus proche au plus lointain). Un tableau vide = l'appelant agit pour lui-même. |
| `_modes` | Tableau indiquant le mode d'exécution pour chaque action. |
| `_executionCallDatas` | Tableau des actions à exécuter (appels encodés). |

**Important :** Les trois tableaux doivent avoir la même longueur. Chaque index correspond à une exécution distincte.

---

## Concepts clés

### Délégation (Delegation)

Une délégation lie un **délégant** (celui qui donne le droit) à un **délégué** (celui qui peut agir) :

- **delegator** : celui qui autorise
- **delegate** : celui qui peut exécuter
- **authority** : référence à la délégation parente (chaîne de délégations)
- **caveats** : conditions à respecter (voir ci-dessous)

### Caveats

Les caveats sont des conditions attachées à une délégation. Chaque caveat a un **enforcer** (contrat qui vérifie les règles) et des **terms** (les règles elles-mêmes). Exemples : montant max, méthodes autorisées, date limite, etc.

### Chaîne de délégations

Les délégations peuvent être empilées. Par exemple : Alice délègue à Bob, Bob délègue à Charlie. L’ordre dans `_permissionContexts` va de la feuille vers la racine (Charlie → Bob → Alice).

---

## Déroulement de la fonction

### 1. Vérifications préalables

- Les trois tableaux ont la même longueur.
- Le contrat n’est pas en pause.

### 2. Validation des délégations (pour chaque exécution)

#### Cas sans délégation

Si `_permissionContexts[i]` est vide, l’exécution est considérée comme **auto-autorisée** : l’appelant agit pour lui-même.

#### Cas avec délégations

Pour chaque délégation :

1. **Appelant autorisé**  
   Le premier délégué de la chaîne doit être `msg.sender` ou `ANY_DELEGATE` (adresse spéciale qui autorise n’importe qui).

2. **Signatures**  
   Chaque délégation doit être signée par son délégant :
   - EOA : signature ECDSA classique
   - Contrat : vérification via ERC-1271

3. **Autorité**  
   Chaque délégation doit pointer vers la bonne délégation parente. La dernière de la chaîne doit avoir `ROOT_AUTHORITY`.

4. **Délégations actives**  
   Aucune délégation ne doit être désactivée via `disableDelegation`.

### 3. Hooks (crochets) des caveats

Pour chaque exécution, les enforcers des caveats sont appelés dans un ordre précis :

| Étape | Hook | Ordre | Rôle |
|-------|------|-------|------|
| 1 | `beforeAllHook` | feuille → racine | Vérifications avant toute exécution |
| 2 | `beforeHook` | feuille → racine | Vérifications juste avant l’exécution |
| 3 | **Exécution** | — | Appel réel sur le DeleGator du délégant racine |
| 4 | `afterHook` | racine → feuille | Actions après exécution |
| 5 | `afterAllHook` | racine → feuille | Actions finales après tout |

Si un hook échoue, toute la transaction est annulée.

### 4. Exécution

- **Sans délégation** : l’appel est délégué à `msg.sender` (l’appelant exécute pour lui-même).
- **Avec délégations** : l’appel est effectué sur le DeleGator du **délégant racine** (dernier de la chaîne).

### 5. Événements

Pour chaque délégation utilisée, un événement `RedeemedDelegation` est émis.

---

## Schéma du flux

```
┌─────────────────────────────────────────────────────────────────┐
│  redeemDelegations(_permissionContexts, _modes, _executionCallDatas)  │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  1. Vérifier longueurs des tableaux + contrat non en pause       │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  2. Pour chaque exécution :                                     │
│     - Décoder les délégations                                   │
│     - Valider appelant = premier délégué (ou ANY_DELEGATE)       │
│     - Valider signatures (EOA ou ERC-1271)                      │
│     - Valider chaîne d'autorité                                 │
│     - Vérifier délégations non désactivées                      │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  3. beforeAllHook (feuille → racine) pour chaque caveat         │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  4. Pour chaque exécution :                                     │
│     - beforeHook (feuille → racine)                             │
│     - Exécution sur DeleGator du délégant racine                │
│     - afterHook (racine → feuille)                              │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  5. afterAllHook (racine → feuille) pour chaque caveat          │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  6. Émettre RedeemedDelegation pour chaque délégation           │
└─────────────────────────────────────────────────────────────────┘
```

---

## Exemple simple

Alice délègue à Bob le droit d’appeler `increment()` sur son contrat Counter, avec un caveat limitant les méthodes autorisées.

1. Bob appelle `redeemDelegations` avec :
   - `_permissionContexts` : délégation signée d’Alice
   - `_modes` : mode d’exécution simple
   - `_executionCallDatas` : appel encodé vers `increment()`

2. Le contrat vérifie que Bob est bien le délégué et que la signature d’Alice est valide.

3. Les caveats sont vérifiés (ex. méthode autorisée).

4. L’exécution est effectuée sur le DeleGator d’Alice : le compteur est incrémenté.

5. Les événements sont émis.

---

## Flux end-to-end : de la UserOp à l'exécution

Cette section décrit le parcours complet d’une opération, depuis la création de la UserOp jusqu’à l’exécution on-chain, en passant par les protocoles sous-jacents.

### Protocoles impliqués

| Protocole | Rôle |
|-----------|------|
| **ERC-4337** (Account Abstraction) | UserOp, EntryPoint, Bundler, validation et exécution des opérations |
| **ERC-7710** | Cadre de délégation (Delegation, Caveat, DelegationManager) |
| **ERC-7579** | Format des exécutions (ModeCode, Execution) |
| **EIP-712** | Signatures typées pour la UserOp et les délégations |
| **EIP-1271** | Signatures des contrats (DeleGator, délégations) |

### Vue d’ensemble du flux

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌──────────────────┐
│   Bob       │────▶│   Bundler   │────▶│  EntryPoint │────▶│ DelegationManager│
│  (délégué)  │     │  (relais)   │     │  (ERC-4337) │     │   + DeleGators   │
└─────────────┘     └─────────────┘     └─────────────┘     └──────────────────┘
      │                     │                    │                      │
      │ 1. Crée & signe     │ 2. Reçoit UserOp   │ 3. handleOps()       │ 4. Validation
      │    UserOp           │    (RPC/mempool)   │    validation +      │    + exécution
      │                     │                    │    exécution         │
```

### Étape 1 : Création et signature de la UserOp (côté client)

Bob (le délégué) prépare une UserOp pour exécuter une délégation :

1. **Contenu de la UserOp** :
   - `sender` : adresse du DeleGator de Bob (compte smart contract de Bob)
   - `callData` : appel encodé vers `redeemDelegations(permissionContexts, modes, executionCallDatas)`
   - `nonce` : nonce du compte pour éviter les rejeux
   - `initCode` : optionnel, pour déployer le compte si nécessaire

2. **Signature** : Bob signe le hash EIP-712 de la UserOp avec sa clé (EOA, P256 ou multi-sig selon son DeleGator).

3. **Envoi** : La UserOp signée est envoyée au Bundler (RPC, mempool ERC-4337, ou autre canal).

### Étape 2 : Réception par le Bundler

Le Bundler reçoit la UserOp (via `eth_sendUserOperation` ou équivalent). Il peut :

- Agréger plusieurs UserOps
- Simuler la validation pour vérifier qu’elle passera
- Déposer du gaz à l’EntryPoint si besoin
- Appeler `EntryPoint.handleOps(userOps, beneficiary)` pour exécuter

### Étape 3 : EntryPoint (ERC-4337)

L’EntryPoint exécute chaque UserOp en deux phases :

#### Phase de validation

1. L’EntryPoint appelle `DeleGator.validateUserOp(userOp, ...)` sur le compte (DeleGator de Bob).
2. Le DeleGator vérifie la signature de la UserOp (Bob a bien autorisé cette opération).
3. Le DeleGator peut payer le prefund pour rembourser le Bundler.

#### Phase d’exécution

1. L’EntryPoint appelle le DeleGator de Bob avec `callData` = l’appel à `redeemDelegations(...)`.
2. `msg.sender` = EntryPoint, donc le modificateur `onlyEntryPointOrSelf` du DeleGator est satisfait.
3. Le DeleGatorCore exécute : `delegationManager.redeemDelegations(...)`.

### Étape 4 : DelegationManager et exécution

La chaîne d’appels est la suivante :

```
EntryPoint.handleOps()
  └─▶ EntryPoint appelle account.call(callData)  [account = DeleGator de Bob]
        └─▶ DeleGatorCore.redeemDelegations()   [msg.sender = EntryPoint]
              └─▶ delegationManager.redeemDelegations()  [msg.sender = DeleGator de Bob]
```

Le DelegationManager reçoit l’appel avec `msg.sender` = DeleGator de Bob. Le premier `delegate` de la chaîne de délégations doit donc être le DeleGator de Bob.

Le DelegationManager effectue alors :

1. Validation des délégations (signatures, autorité, non-désactivation)
2. Hooks des caveats (`beforeAllHook`, `beforeHook`)
3. Exécution : `executeFromExecutor()` sur le DeleGator du **délégant racine** (ex. Alice)
4. Hooks des caveats (`afterHook`, `afterAllHook`)
5. Émission des événements `RedeemedDelegation`

### Schéma séquentiel complet

```
Bob (client)          Bundler           EntryPoint         DeleGator Bob      DelegationManager      DeleGator Alice
      │                    │                    │                    │                    │                    │
      │  UserOp signée      │                    │                    │                    │                    │
      │───────────────────▶│                    │                    │                    │                    │
      │                    │  handleOps()       │                    │                    │                    │
      │                    │───────────────────▶│                    │                    │                    │
      │                    │                    │  validateUserOp  │                    │                    │
      │                    │                    │──────────────────▶│                    │                    │
      │                    │                    │  (vérif signature) │                    │                    │
      │                    │                    │◀──────────────────│                    │                    │
      │                    │                    │  call(redeemDelegations)                │                    │
      │                    │                    │──────────────────▶│                    │                    │
      │                    │                    │                    │  redeemDelegations │                    │
      │                    │                    │                    │───────────────────▶│                    │
      │                    │                    │                    │                    │  beforeAllHook    │
      │                    │                    │                    │                    │  beforeHook       │
      │                    │                    │                    │                    │  executeFromExecutor
      │                    │                    │                    │                    │───────────────────▶│
      │                    │                    │                    │                    │  (exécution réelle) │
      │                    │                    │                    │                    │◀───────────────────│
      │                    │                    │                    │                    │  afterHook         │
      │                    │                    │                    │                    │  afterAllHook     │
      │                    │                    │                    │◀───────────────────│                    │
      │                    │                    │◀───────────────────│                    │                    │
      │                    │◀───────────────────│  (remboursement    │                    │                    │
      │                    │                    │   gaz au Bundler)  │                    │                    │
```

### Points importants

- **Qui paie le gaz ?** Le Bundler avance le gaz. Il est remboursé via le dépôt du compte à l’EntryPoint (ou via un Paymaster).
- **Qui exécute ?** L’exécution réelle (ex. `increment()` sur le Counter) se fait dans le contexte du DeleGator du **délégant racine** (Alice), pas de Bob.
- **Double signature** : Bob signe la UserOp (autorisation d’utiliser son compte). Alice a signé la délégation (autorisation pour Bob d’agir en son nom).

---

## Erreurs possibles

| Erreur | Signification |
|--------|---------------|
| `BatchDataLengthMismatch` | Les trois tableaux n’ont pas la même longueur. |
| `InvalidDelegate` | L’appelant n’est pas le délégué attendu. |
| `InvalidEOASignature` | Signature EOA invalide. |
| `InvalidERC1271Signature` | Signature ERC-1271 invalide. |
| `InvalidAuthority` | Chaîne d’autorité incorrecte. |
| `CannotUseADisabledDelegation` | Une délégation utilisée a été désactivée. |

---

## Résumé

`redeemDelegations` permet d’exécuter des actions au nom d’autres comptes via des délégations signées. Elle :

1. Valide les signatures et la chaîne d’autorité
2. Applique les caveats via des hooks avant et après l’exécution
3. Exécute les actions sur le DeleGator du délégant racine
4. Émet les événements correspondants
