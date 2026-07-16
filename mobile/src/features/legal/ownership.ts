import type { SettingsMetadata } from '../../settings/repo';

const acceptanceKey = 'ownershipNoticeAccepted';

export function hasAcceptedOwnershipNotice(metadata: SettingsMetadata): boolean {
  return metadata[acceptanceKey] === true;
}

export function acceptOwnershipNotice(metadata: SettingsMetadata): SettingsMetadata {
  return { ...metadata, [acceptanceKey]: true };
}
