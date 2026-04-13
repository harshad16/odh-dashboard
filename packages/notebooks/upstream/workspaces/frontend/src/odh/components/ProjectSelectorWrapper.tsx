import React from 'react';
import { useNamespaceSelector } from 'mod-arch-core';
import { SimpleSelect } from 'mod-arch-shared';
import { SimpleSelectOption } from 'mod-arch-shared/dist/components/SimpleSelect';
import { Flex, FlexItem, Spinner, Content, ContentVariants } from '@patternfly/react-core';
import { FolderIcon } from '@patternfly/react-icons';

const ProjectSelectorWrapper: React.FC = () => {
  const {
    preferredNamespace,
    updatePreferredNamespace,
    namespaces,
    namespacesLoaded,
  } = useNamespaceSelector({
    storageKey: 'kubeflow.notebooks.namespace.lastUsed',
    storeLastNamespace: true,
  });

  const selectedNamespace = preferredNamespace?.name ?? '';

  const handleSelect = React.useCallback(
    (namespace: string) => {
      updatePreferredNamespace({ name: namespace });
    },
    [updatePreferredNamespace],
  );

  if (!namespacesLoaded) {
    return (
      <Flex alignItems={{ default: 'alignItemsCenter' }} spaceItems={{ default: 'spaceItemsSm' }}>
        <FlexItem>
          <Spinner size="md" />
        </FlexItem>
        <FlexItem>
          <Content component={ContentVariants.small}>Loading projects...</Content>
        </FlexItem>
      </Flex>
    );
  }

  const options: SimpleSelectOption[] = namespaces.map((ns) => ({
    key: ns.name,
    label: ns.name,
  }));

  return (
    <Flex alignItems={{ default: 'alignItemsCenter' }} spaceItems={{ default: 'spaceItemsSm' }}>
      <FlexItem>
        <FolderIcon />
      </FlexItem>
      <FlexItem>
        <Content component={ContentVariants.small}>Project</Content>
      </FlexItem>
      <FlexItem>
        <SimpleSelect
          options={options}
          value={selectedNamespace}
          onChange={(key, isPlaceholder) => {
            if (!isPlaceholder && key) {
              handleSelect(key);
            }
          }}
          placeholder="Select a project"
          isDisabled={namespaces.length === 0}
          isScrollable
          maxMenuHeight="300px"
          dataTestId="project-selector"
        />
      </FlexItem>
    </Flex>
  );
};

export default ProjectSelectorWrapper;
