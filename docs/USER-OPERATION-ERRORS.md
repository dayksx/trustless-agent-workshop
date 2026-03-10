# Erreurs courantes des UserOperations (ERC-4337)

Ce document liste les erreurs fréquentes rencontrées lors de l'envoi de UserOperations (comptes abstraits ERC-4337) et leurs solutions.

---

## 1. Codes d'erreur EntryPoint (AAxx)

Les codes AAxx sont retournés par le contrat EntryPoint ERC-4337 lors de la validation ou l'exécution des UserOperations.

### Création de compte (AA1x)

| Code | Description | Solutions |
|------|-------------|-----------|
| **AA10** | Sender already constructed | Le compte existe déjà. Retirez `initCode` des UserOps pour les comptes existants. |
| **AA13** | initCode failed or OOG | La création a échoué ou manqué de gaz. Vérifiez la factory, augmentez `verificationGasLimit`. |
| **AA14** | initCode must return sender | La factory doit retourner l'adresse du sender. Vérifiez la logique de déploiement. |
| **AA15** | initCode must create sender | Aucun contrat n'a été déployé à l'adresse sender. Vérifiez la factory. |

### Sender / UserOp (AA2x)

| Code | Description | Solutions |
|------|-------------|-----------|
| **AA20** | Account not deployed | Le compte n'existe pas. Incluez `initCode` pour la première transaction. |
| **AA21** | Didn't pay prefund | Le sender n'a pas assez de dépôt pour le gaz. Utilisez un paymaster ou déposez via `depositTo`. |
| **AA22** | Expired or not due | Signature hors de la fenêtre de validité (`validUntil` / `validAfter`). Vérifiez les timestamps. |
| **AA23** | Reverted (OOG) | `validateUserOp` a revert ou manqué de gaz. Vérifiez la signature, augmentez `verificationGasLimit`. |
| **AA24** | Signature error | Signature invalide. Vérifiez la clé privée, le format de signature et l'aggregator. |
| **AA25** | Invalid account nonce | Nonce incorrect. Récupérez le nonce actuel avant de soumettre. |
| **AA26** | Over verificationGasLimit | Validation dépasse `verificationGasLimit`. Augmentez la limite ou optimisez la validation. |

### Paymaster (AA3x)

| Code | Description | Solutions |
|------|-------------|-----------|
| **AA30** | Paymaster not deployed | L'adresse paymaster n'a pas de code. Vérifiez les premiers bytes de `paymasterAndData`. |
| **AA31** | Paymaster deposit too low | Le paymaster n'a pas assez de dépôt. Augmentez le stake via le contrat paymaster. |
| **AA32** | Paymaster expired or not due | Fenêtre de validité du paymaster expirée. Soumettez dans le délai autorisé. |
| **AA33** | Paymaster reverted | `validatePaymasterUserOp` a revert. Vérifiez la logique et la signature du paymaster. |
| **AA34** | Paymaster signature error | Signature paymaster invalide. Vérifiez le format de `paymasterAndData`. |
| **AA36** | Over paymasterVerificationGasLimit | Augmentez `paymasterVerificationGasLimit`. |

### Vérification générale (AA4x)

| Code | Description | Solutions |
|------|-------------|-----------|
| **AA40** | Over verification gas limit | Augmentez `verificationGasLimit`. |
| **AA41** | Too little verification gas | La validation a manqué de gaz. Augmentez `verificationGasLimit`. |

### Post-exécution (AA5x)

| Code | Description | Solutions |
|------|-------------|-----------|
| **AA50** | PostOp reverted | La logique post-op du paymaster a revert. Débuggez le postOp. |
| **AA51** | prefund below actualGasCost | Le coût réel dépasse le prefund. Augmentez les limites de gaz. |

### Général (AA9x)

| Code | Description | Solutions |
|------|-------------|-----------|
| **AA90** | Invalid beneficiary | `beneficiary` est `address(0)` ou invalide. |
| **AA91** | Failed send to beneficiary | Transfert des frais vers le beneficiary a échoué. |
| **AA92** | Internal call only | Appel interne non autorisé. Utilisez `handleOps`, pas `innerHandleOp`. |
| **AA93** | Invalid paymasterAndData | Format ou longueur invalide. Vérifiez la structure. |
| **AA94** | Gas values overflow | Les valeurs de gaz dépassent 120 bits. Réduisez les paramètres. |
| **AA95** | Out of gas | Manque de gaz global. Augmentez les limites de gaz. |
| **AA96** | Invalid aggregator | Adresse aggregator invalide ou réservée. |

---

## 2. Erreurs de simulation (Bundler)

### UserOperation reverted during simulation

Le bundler simule la UserOp avant de l'envoyer. Si la simulation échoue, l'opération n'est pas envoyée.

**Erreur typique :**
```
UserOperation reverted during simulation with reason: 0xb5863604
```

**0xb5863604 – Erreurs courantes du DelegationManager (ERC-7710) :**

| Cause | Description | Solution |
|-------|-------------|----------|
| **InvalidDelegate** | Le `delegate` dans la délégation ne correspond pas à `msg.sender` (le redeemer). | `AGENT2_SA_ADDRESS` doit être l'adresse du DeleGator (smart account), pas l'EOA. Ou définir `AGENT2_PRIVATE_KEY` pour que le delegator utilise automatiquement la bonne adresse. |
| **CannotUseADisabledDelegation** | La délégation a été désactivée via `disableDelegation`. | Créer une nouvelle délégation ou appeler `enableDelegation`. |
| **Solde insuffisant** | Le delegator n'a pas assez d'ETH pour le transfert. | Financer le delegator sur Base Sepolia. |
| **Caveat enforcer** | Un caveat (ex. `nativeTokenTransferAmount`) a échoué. | Vérifier les termes et le montant. |

**NativeTokenTransferAmountEnforcer:allowance-exceeded (0x08c379a0) :**

| Cause | Description | Solution |
|-------|-------------|----------|
| **allowance-exceeded** | Le montant demandé dépasse l'allowance restante de la délégation. L'enforcer suit `spentMap[sender][delegationHash]` : les délégations avec le même hash partagent le même compteur. | Utiliser un **salt unique** par délégation (`createDelegation(..., { salt: '0x' + randomBytes(32).toString('hex') })`). Si déjà redeemée, créer une nouvelle délégation avec un nouveau salt. Vérifier que le montant du tool correspond au maxAmount de la caveat. |

**revert reason: 0x (empty) :**

| Cause | Solution |
|-------|----------|
| **Paymaster rejection** | Set `USE_PAYMASTER=false` or omit it. Fund the delegate smart account with ETH for gas. |
| **Delegator balance** | The delegator (AGENT1_SA_ADDRESS) must have enough ETH for the transfer. |
| **Delegate ≠ redeemer** | AGENT2_SA_ADDRESS must match the smart account from AGENT2_PRIVATE_KEY. |

**Solutions :**

- Définir `AGENT2_PRIVATE_KEY` dans `.env` lors de la création des délégations : le script dérive automatiquement l'adresse DeleGator correcte.
- Si vous utilisez uniquement `AGENT2_SA_ADDRESS`, celle-ci doit être l'adresse du DeleGator (smart account), pas l'adresse EOA.
- Vérifier le solde du delegator sur Base Sepolia.
- Obtenir des ETH de test : [Base Sepolia Faucet](https://www.coinbase.com/faucets/base-ethereum-goerli-faucet).

---

## 3. Erreurs de configuration

| Erreur | Cause | Solution |
|--------|-------|----------|
| `Missing AGENT2_PRIVATE_KEY or BUNDLER_BASE_SEPOLIA_URL` | Variables d'environnement manquantes | Définir `.env` avec les clés requises. |
| `Delegation missing signedDelegation` | Objet de délégation incomplet | Inclure `signedDelegation` dans le payload. |
| `Invalid chain` | Chaîne non supportée par le bundler | Utiliser Base Sepolia ou chaîne configurée. |

---

## 4. Erreurs Viem / SDK

| Erreur | Cause | Solution |
|--------|-------|----------|
| `createPublicClient is not defined` | Imports manquants | Importer `createPublicClient`, `http`, `baseSepolia` depuis viem. |
| `getBundlerClient is not defined` | Config supprimée | Créer les clients directement (ex. `createBundlerClient`). |
| `Type '{}' is missing properties` | Type de délégation incorrect | Caster `signedDelegation as any` si nécessaire. |

---

## 5. Références

- [Alchemy Docs - EntryPoint v0.7 Revert Codes](https://www.alchemy.com/docs/wallets/reference/entrypoint-v07-revert-codes)
- [Candide - Entrypoint Error Codes](https://docs.candide.dev/wallet/technical-reference/entrypoint-error-codes/)
- [MetaMask Delegation Toolkit - Caveat Enforcers](https://docs.metamask.io/delegation-toolkit/concepts/caveat-enforcers)
- [ERC-4337 Documentation](https://www.erc4337.io/docs)
