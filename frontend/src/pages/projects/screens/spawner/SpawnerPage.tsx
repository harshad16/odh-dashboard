import * as React from 'react';
import { Link } from 'react-router-dom';
import {
  Alert,
  Breadcrumb,
  BreadcrumbItem,
  Form,
  FormSection,
  PageSection,
  Stack,
  StackItem,
} from '@patternfly/react-core';
import ApplicationsPage from '~/pages/ApplicationsPage';
import { ImageStreamAndVersion } from '~/types';
import GenericSidebar from '~/components/GenericSidebar';
import NameDescriptionField from '~/concepts/k8s/NameDescriptionField';
import { ProjectDetailsContext } from '~/pages/projects/ProjectDetailsContext';
import { NameDescType } from '~/pages/projects/types';
import {
  getNotebookDescription,
  getNotebookDisplayName,
  getProjectDisplayName,
} from '~/pages/projects/utils';
import GPUSelectField from '~/pages/notebookController/screens/server/GPUSelectField';
import { NotebookKind } from '~/k8sTypes';
import useNotebookImageData from '~/pages/projects/screens/detail/notebooks/useNotebookImageData';
import useNotebookDeploymentSize from '~/pages/projects/screens/detail/notebooks/useNotebookDeploymentSize';
import useNotebookGPUNumber from '~/pages/projects/screens/detail/notebooks/useNotebookGPUNumber';
import NotebookRestartAlert from '~/pages/projects/components/NotebookRestartAlert';
import useWillNotebooksRestart from '~/pages/projects/notebook/useWillNotebooksRestart';
import CanEnableElyraPipelinesCheck from '~/concepts/pipelines/elyra/CanEnableElyraPipelinesCheck';
import { SpawnerPageSectionID } from './types';
import { ScrollableSelectorID, SpawnerPageSectionTitles } from './const';
import SpawnerFooter from './SpawnerFooter';
import ImageSelectorField from './imageSelector/ImageSelectorField';
import ContainerSizeSelector from './deploymentSize/ContainerSizeSelector';
import { useNotebookSize } from './useNotebookSize';
import StorageField from './storage/StorageField';
import EnvironmentVariables from './environmentVariables/EnvironmentVariables';
import { useStorageDataObject } from './storage/utils';
import { getRootVolumeName, useMergeDefaultPVCName } from './spawnerUtils';
import { useNotebookEnvVariables } from './environmentVariables/useNotebookEnvVariables';
import DataConnectionField from './dataConnection/DataConnectionField';
import { useNotebookDataConnection } from './dataConnection/useNotebookDataConnection';

type SpawnerPageProps = {
  existingNotebook?: NotebookKind;
};

const SpawnerPage: React.FC<SpawnerPageProps> = ({ existingNotebook }) => {
  const { currentProject, dataConnections } = React.useContext(ProjectDetailsContext);
  const displayName = getProjectDisplayName(currentProject);

  const [nameDesc, setNameDesc] = React.useState<NameDescType>({
    name: '',
    k8sName: undefined,
    description: '',
  });
  const [selectedImage, setSelectedImage] = React.useState<ImageStreamAndVersion>({
    imageStream: undefined,
    imageVersion: undefined,
  });
  const { selectedSize, setSelectedSize, sizes } = useNotebookSize();
  const [selectedGpu, setSelectedGpu] = React.useState('0');
  const [storageDataWithoutDefault, setStorageData] = useStorageDataObject(existingNotebook);
  const storageData = useMergeDefaultPVCName(storageDataWithoutDefault, nameDesc.name);
  const [envVariables, setEnvVariables] = useNotebookEnvVariables(existingNotebook);
  const [dataConnection, setDataConnection] = useNotebookDataConnection(
    existingNotebook,
    dataConnections.data,
  );

  const restartNotebooks = useWillNotebooksRestart([existingNotebook?.metadata.name || '']);

  React.useEffect(() => {
    if (existingNotebook) {
      setNameDesc({
        name: getNotebookDisplayName(existingNotebook),
        k8sName: existingNotebook.metadata.name,
        description: getNotebookDescription(existingNotebook),
      });
    }
  }, [existingNotebook, setStorageData]);

  const [data, loaded] = useNotebookImageData(existingNotebook);
  React.useEffect(() => {
    const { imageStream, imageVersion } = data || {};
    if (loaded && imageStream && imageVersion) {
      setSelectedImage({ imageStream, imageVersion });
    }
  }, [data, loaded]);

  const { size: notebookSize } = useNotebookDeploymentSize(existingNotebook);
  React.useEffect(() => {
    if (notebookSize) {
      setSelectedSize(notebookSize.name);
    }
  }, [notebookSize, setSelectedSize]);

  const notebookGPU = useNotebookGPUNumber(existingNotebook);
  React.useEffect(() => {
    setSelectedGpu(notebookGPU.toString());
  }, [notebookGPU, setSelectedGpu]);

  const editNotebookDisplayName = existingNotebook ? getNotebookDisplayName(existingNotebook) : '';

  const sectionIDs = Object.values(SpawnerPageSectionID);

  return (
    <ApplicationsPage
      title={existingNotebook ? `Edit ${editNotebookDisplayName}` : 'Create workbench'}
      breadcrumb={
        <Breadcrumb>
          <BreadcrumbItem render={() => <Link to="/projects">Data science projects</Link>} />
          <BreadcrumbItem
            render={() => (
              <Link to={`/projects/${currentProject.metadata.name}`}>{displayName}</Link>
            )}
          />
          {existingNotebook && <BreadcrumbItem>{editNotebookDisplayName}</BreadcrumbItem>}
          <BreadcrumbItem>{existingNotebook ? 'Edit' : 'Create'} workbench</BreadcrumbItem>
        </Breadcrumb>
      }
      description={
        existingNotebook
          ? 'Modify properties for your workbench.'
          : 'Configure properties for your workbench.'
      }
      loaded
      empty={false}
    >
      <PageSection
        isFilled
        id={ScrollableSelectorID}
        aria-label="spawner-page-spawner-section"
        hasOverflowScroll
        variant="light"
      >
        <GenericSidebar
          sections={sectionIDs}
          titles={SpawnerPageSectionTitles}
          scrollableSelector={`#${ScrollableSelectorID}`}
        >
          <Form style={{ maxWidth: 600 }}>
            <FormSection
              id={SpawnerPageSectionID.NAME_DESCRIPTION}
              aria-label={SpawnerPageSectionTitles[SpawnerPageSectionID.NAME_DESCRIPTION]}
            >
              <NameDescriptionField
                nameFieldId="workbench-name"
                descriptionFieldId="workbench-description"
                data={nameDesc}
                setData={setNameDesc}
                autoFocusName
              />
            </FormSection>
            <FormSection
              title={SpawnerPageSectionTitles[SpawnerPageSectionID.NOTEBOOK_IMAGE]}
              id={SpawnerPageSectionID.NOTEBOOK_IMAGE}
              aria-label={SpawnerPageSectionTitles[SpawnerPageSectionID.NOTEBOOK_IMAGE]}
            >
              <ImageSelectorField
                selectedImage={selectedImage}
                setSelectedImage={setSelectedImage}
              />
            </FormSection>
            <FormSection
              title={SpawnerPageSectionTitles[SpawnerPageSectionID.DEPLOYMENT_SIZE]}
              id={SpawnerPageSectionID.DEPLOYMENT_SIZE}
              aria-label={SpawnerPageSectionTitles[SpawnerPageSectionID.DEPLOYMENT_SIZE]}
            >
              <ContainerSizeSelector
                sizes={sizes}
                setValue={setSelectedSize}
                value={selectedSize}
              />
              <GPUSelectField
                value={selectedGpu}
                setValue={(value: string) => setSelectedGpu(value)}
              />
            </FormSection>
            <FormSection
              title={SpawnerPageSectionTitles[SpawnerPageSectionID.ENVIRONMENT_VARIABLES]}
              id={SpawnerPageSectionID.ENVIRONMENT_VARIABLES}
              aria-label={SpawnerPageSectionTitles[SpawnerPageSectionID.ENVIRONMENT_VARIABLES]}
            >
              <EnvironmentVariables envVariables={envVariables} setEnvVariables={setEnvVariables} />
            </FormSection>
            <FormSection
              title={SpawnerPageSectionTitles[SpawnerPageSectionID.CLUSTER_STORAGE]}
              id={SpawnerPageSectionID.CLUSTER_STORAGE}
              aria-label={SpawnerPageSectionTitles[SpawnerPageSectionID.CLUSTER_STORAGE]}
            >
              <Alert
                component="h2"
                variant="info"
                isPlain
                isInline
                title="Cluster storage will mount to /"
              />
              <StorageField
                storageData={storageData}
                setStorageData={setStorageData}
                editStorage={getRootVolumeName(existingNotebook)}
              />
            </FormSection>
            <FormSection
              title={SpawnerPageSectionTitles[SpawnerPageSectionID.DATA_CONNECTIONS]}
              id={SpawnerPageSectionID.DATA_CONNECTIONS}
              aria-label={SpawnerPageSectionTitles[SpawnerPageSectionID.DATA_CONNECTIONS]}
            >
              <DataConnectionField
                dataConnection={dataConnection}
                setDataConnection={(connection) => setDataConnection(connection)}
              />
            </FormSection>
          </Form>
        </GenericSidebar>
      </PageSection>
      <PageSection stickyOnBreakpoint={{ default: 'bottom' }} variant="light">
        <Stack hasGutter>
          {restartNotebooks.length !== 0 && (
            <StackItem>
              <NotebookRestartAlert notebooks={restartNotebooks} isCurrent />
            </StackItem>
          )}
          <StackItem>
            <CanEnableElyraPipelinesCheck namespace={currentProject.metadata.name}>
              {(canEnablePipelines) => (
                <SpawnerFooter
                  startNotebookData={{
                    notebookName: nameDesc.name,
                    description: nameDesc.description,
                    projectName: currentProject.metadata.name,
                    image: selectedImage,
                    notebookSize: selectedSize,
                    gpus: parseInt(selectedGpu),
                    volumes: [],
                    volumeMounts: [],
                  }}
                  storageData={storageData}
                  envVariables={envVariables}
                  dataConnection={dataConnection}
                  canEnablePipelines={canEnablePipelines}
                />
              )}
            </CanEnableElyraPipelinesCheck>
          </StackItem>
        </Stack>
      </PageSection>
    </ApplicationsPage>
  );
};

export default SpawnerPage;
