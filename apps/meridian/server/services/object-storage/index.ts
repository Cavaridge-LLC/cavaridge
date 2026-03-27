export {
  ObjectStorageService,
  ObjectNotFoundError,
  objectStorageService,
} from './objectStorage';

export type {
  ObjectAclPolicy,
  ObjectAccessGroup,
  ObjectAclRule,
} from './objectAcl';

export {
  ObjectAccessGroupType,
  ObjectPermission,
  canAccessObject,
} from './objectAcl';

export { registerObjectStorageRoutes } from './routes';
