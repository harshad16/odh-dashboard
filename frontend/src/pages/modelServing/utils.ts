import { isCpuLimitLarger, isMemoryLimitLarger } from '~/utilities/valueUnits';
import {
  assembleSecretSA,
  createRoleBinding,
  createSecret,
  deleteSecret,
  generateRoleBindingServingRuntime,
  replaceSecret,
  assembleServiceAccount,
  createServiceAccount,
} from '~/api';
import { SecretKind, K8sStatus } from '~/k8sTypes';
import { ContainerResources } from '~/types';
import { allSettledPromises } from '~/utilities/allSettledPromises';
import { translateDisplayNameForK8s } from '~/pages/projects/utils';
import { CreatingServingRuntimeObject } from '~/pages/modelServing/screens/types';

export const getModelServingRuntimeName = (namespace: string): string =>
  `model-server-${namespace}`;

export const getModelServiceAccountName = (name: string): string => `${name}-sa`;

export const getModelRoleBinding = (name: string): string => `${name}-view`;

const isValidCpuOrMemoryValue = (value?: string) =>
  value === undefined ? true : parseInt(value) > 0;

export const resourcesArePositive = (resources: ContainerResources): boolean =>
  isValidCpuOrMemoryValue(resources.limits?.cpu) &&
  isValidCpuOrMemoryValue(resources.limits?.memory) &&
  isValidCpuOrMemoryValue(resources.requests?.cpu) &&
  isValidCpuOrMemoryValue(resources.requests?.memory);

export const requestsUnderLimits = (resources: ContainerResources): boolean =>
  isCpuLimitLarger(resources.requests?.cpu, resources.limits?.cpu, true) &&
  isMemoryLimitLarger(resources.requests?.memory, resources.limits?.memory, true);

export const setUpTokenAuth = async (
  fillData: CreatingServingRuntimeObject,
  servingRuntimeName: string,
  namespace: string,
): Promise<void> => {
  const { serviceAccountName, roleBindingName } = getTokenNames(servingRuntimeName, namespace);

  const serviceAccount = assembleServiceAccount(serviceAccountName, namespace);
  const tokenAuth = generateRoleBindingServingRuntime(
    roleBindingName,
    serviceAccountName,
    namespace,
  );
  return Promise.all([createServiceAccount(serviceAccount), createRoleBinding(tokenAuth)])
    .then(() => {
      allSettledPromises<SecretKind, Error>(
        fillData.tokens.map((token) => {
          const secretToken = assembleSecretSA(token.name, serviceAccountName, namespace);
          return createSecret(secretToken);
        }),
      )
        .then(() => Promise.resolve())
        .catch((error) => Promise.reject(error));
    })
    .catch((error) => Promise.reject(error));
};

export const updateSecrets = async (
  fillData: CreatingServingRuntimeObject,
  servingRuntimeName: string,
  namespace: string,
  secrets: SecretKind[],
): Promise<void> => {
  const { serviceAccountName } = getTokenNames(servingRuntimeName, namespace);
  const deletedSecrets = secrets
    .map((secret) => secret.metadata.name)
    .filter((token) => !fillData.tokens.some((tokenEdit) => tokenEdit.editName === token));

  return Promise.all<K8sStatus | SecretKind>([
    ...fillData.tokens
      .filter((token) => translateDisplayNameForK8s(token.name) !== token.editName)
      .map((token) => {
        const secretToken = assembleSecretSA(
          token.name,
          serviceAccountName,
          namespace,
          token.editName,
        );
        if (token.editName) {
          return replaceSecret(secretToken);
        }
        return createSecret(secretToken);
      }),
    ...deletedSecrets.map((secret) => deleteSecret(namespace, secret)),
  ])
    .then(() => Promise.resolve())
    .catch((error) => Promise.reject(error));
};

export const getTokenNames = (servingRuntimeName: string, namespace: string) => {
  const name =
    servingRuntimeName !== '' ? servingRuntimeName : getModelServingRuntimeName(namespace);

  const serviceAccountName = getModelServiceAccountName(name);
  const roleBindingName = getModelRoleBinding(name);

  return { serviceAccountName, roleBindingName };
};
