export type TenantRelation = {
  tenantId: string;
  role: string;
  tenantName: string;
};

export function resolveTenantRelation(relations: TenantRelation[], configuredTenantId?: string) {
  if (configuredTenantId) {
    return relations.find((relation) => relation.tenantId === configuredTenantId);
  }

  return relations.length === 1 ? relations[0] : undefined;
}
