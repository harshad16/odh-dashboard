import React, { useEffect, useRef, useMemo, useState, useImperativeHandle } from 'react';
import { Content } from '@patternfly/react-core/dist/esm/components/Content';
import { Split, SplitItem } from '@patternfly/react-core/dist/esm/layouts/Split';
import { WorkspaceFormImageList } from '~/app/pages/Workspaces/Form/image/WorkspaceFormImageList';
import {
  ExtraFilter,
  FilterByLabels,
} from '~/app/pages/Workspaces/Form/labelFilter/FilterByLabels';
import { WorkspacekindsImageConfigValue } from '~/generated/data-contracts';
import { computeDefaultFilterValues } from '~/app/pages/Workspaces/Form/utils/filterDefaults';

export type ImageSelectionFilterHandle = {
  adaptFiltersForImage: (image: WorkspacekindsImageConfigValue) => void;
};

interface WorkspaceFormImageSelectionProps {
  images: WorkspacekindsImageConfigValue[];
  selectedImage: WorkspacekindsImageConfigValue | undefined;
  onSelect: (image: WorkspacekindsImageConfigValue | undefined) => void;
  defaultImageId?: string;
  filterControlRef?: React.Ref<ImageSelectionFilterHandle>;
}

const WorkspaceFormImageSelection: React.FunctionComponent<WorkspaceFormImageSelectionProps> = ({
  images,
  selectedImage,
  onSelect,
  defaultImageId,
  filterControlRef,
}) => {
  const [filteredImages, setFilteredImages] = useState<WorkspacekindsImageConfigValue[]>(images);

  const extraFilters: ExtraFilter<WorkspacekindsImageConfigValue>[] = useMemo(
    () => [
      {
        label: 'Show hidden',
        value: false,
        key: 'showHidden',
        matchesFilter: (image: WorkspacekindsImageConfigValue, value: boolean) =>
          value || !image.hidden,
      },
      {
        label: 'Show redirected',
        value: false,
        key: 'showRedirected',
        matchesFilter: (image: WorkspacekindsImageConfigValue, value: boolean) =>
          value || image.redirect === undefined,
      },
    ],
    [],
  );

  const imageFilterContent = useMemo(
    () => (
      <FilterByLabels
        labelledObjects={images}
        setLabelledObjects={(obj) => setFilteredImages(obj as WorkspacekindsImageConfigValue[])}
        extraFilters={extraFilters}
      />
    ),
    [images, setFilteredImages, extraFilters],
    [images, setFilteredImages, extraFilters],
  );

  return (
    <Content className="workspace-form__full-height">
      <Split hasGutter>
        <SplitItem className="workspace-form__filter-sidebar" data-testid="filter-sidebar">
          {imageFilterContent}
        </SplitItem>
        <SplitItem isFilled>
          <WorkspaceFormImageList
            filteredImages={filteredImages}
            allImages={images}
            selectedImage={selectedImage}
            onSelect={onSelect}
            defaultImageId={defaultImageId}
          />
        </SplitItem>
      </Split>
    </Content>
  );
};

export { WorkspaceFormImageSelection };
