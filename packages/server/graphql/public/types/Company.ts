import getRethink from '../../../database/rethinkDriver'
import {RValue} from '../../../database/stricterR'
import {TierEnum as ETierEnum} from '../../../database/types/Invoice'
import OrganizationType from '../../../database/types/Organization'
import OrganizationUser from '../../../database/types/OrganizationUser'
import errorFilter from '../../errorFilter'
import {CompanyResolvers} from '../resolverTypes'

export type CompanySource = {id: string}

const THIRTY_DAYS = 1000 * 60 * 60 * 24 * 30

const Company: CompanyResolvers = {
  activeTeamCount: async ({id: domain}, _args, {dataLoader}) => {
    const organizations = await dataLoader.get('organizationsByActiveDomain').load(domain)
    const orgIds = organizations.map(({id}: OrganizationType) => id)
    const teamsByOrgId = (await dataLoader.get('teamsByOrgIds').loadMany(orgIds)).filter(
      errorFilter
    )
    const teams = teamsByOrgId.flat().filter(({isArchived}) => !isArchived)
    const teamIds = teams.map(({id}) => id)

    const areTeamsActive = await Promise.all(
      teamIds.map(async (teamId) => {
        const activeMeetings = await dataLoader.get('activeMeetingsByTeamId').load(teamId)
        if (activeMeetings.length > 0) {
          return true
        } else {
          const completedMeetings = await dataLoader.get('completedMeetingsByTeamId').load(teamId)
          const completedMeetingsLast30Days = completedMeetings.filter(
            ({endedAt}) => new Date().getTime() - endedAt!.getTime() < THIRTY_DAYS
          )
          return completedMeetingsLast30Days.length > 0
        }
      })
    )
    return areTeamsActive.filter(Boolean).length
  },

  activeUserCount: async ({id: domain}, _args, {dataLoader}) => {
    const organizations = await dataLoader.get('organizationsByActiveDomain').load(domain)
    const orgIds = organizations.map(({id}: OrganizationType) => id)
    const organizationUsersByOrgId = (
      await dataLoader.get('organizationUsersByOrgId').loadMany(orgIds)
    ).filter(errorFilter)
    const organizationUsers = organizationUsersByOrgId.flat()
    const activeOrganizationUsers = organizationUsers.filter(
      (organizationUser: OrganizationUser) => !organizationUser.inactive
    )
    const userIds = activeOrganizationUsers.map(
      (organizationUser: OrganizationUser) => organizationUser.userId
    )
    const uniqueUserIds = new Set(userIds)
    return uniqueUserIds.size
  },

  lastMetAt: async ({id: domain}, _args, {dataLoader}) => {
    const r = await getRethink()
    const organizations = await dataLoader.get('organizationsByActiveDomain').load(domain)
    const orgIds = organizations.map(({id}: OrganizationType) => id)
    const teamsByOrgId = (await dataLoader.get('teamsByOrgIds').loadMany(orgIds)).filter(
      errorFilter
    )
    const teams = teamsByOrgId.flat()
    const teamIds = teams.map(({id}) => id)
    if (teamIds.length === 0) return 0
    const lastMetAt = await r
      .table('NewMeeting')
      .getAll(r.args(teamIds), {index: 'teamId'})
      .max('createdAt' as any)('createdAt')
      .default(null)
      .run()
    return lastMetAt
  },

  meetingCount: async ({id: domain}, _args, {dataLoader}) => {
    const r = await getRethink()
    const organizations = await dataLoader.get('organizationsByActiveDomain').load(domain)
    const orgIds = organizations.map(({id}: OrganizationType) => id)
    const teamsByOrgId = (await dataLoader.get('teamsByOrgIds').loadMany(orgIds)).filter(
      errorFilter
    )
    const teams = teamsByOrgId.flat()
    const teamIds = teams.map(({id}) => id)
    if (teamIds.length === 0) return 0
    return r.table('NewMeeting').getAll(r.args(teamIds), {index: 'teamId'}).count().default(0).run()
  },

  monthlyTeamStreakMax: async ({id: domain}, _args, {dataLoader}) => {
    const r = await getRethink()
    const organizations = await dataLoader.get('organizationsByActiveDomain').load(domain)
    const orgIds = organizations.map(({id}: OrganizationType) => id)
    const teamsByOrgId = (await dataLoader.get('teamsByOrgIds').loadMany(orgIds)).filter(
      errorFilter
    )
    const teams = teamsByOrgId.flat()
    const teamIds = teams.map(({id}) => id)
    if (teamIds.length === 0) return 0
    return (
      r
        .table('NewMeeting')
        .getAll(r.args(teamIds), {index: 'teamId'})
        .filter((row) => row('endedAt').default(null).ne(null))
        // number of months since unix epoch
        .merge((row: RValue) => ({
          epochMonth: row('endedAt').month().add(row('endedAt').year().mul(12))
        }))
        .group((row) => [row('teamId'), row('epochMonth')])
        .count()
        .ungroup()
        .map((row) => ({
          teamId: row('group')(0),
          epochMonth: row('group')(1)
        }))
        .group('teamId')('epochMonth')
        .ungroup()
        .map((row) => ({
          teamId: row('group'),
          epochMonth: row('reduction'),
          // epochMonth shifted 1 index position
          shift: row('reduction')
            .deleteAt(0)
            .map((z) => z.add(-1))
        }))
        .merge((row: RValue) => ({
          // 1 if there are 2 consecutive epochMonths next to each other, else 0
          teamStreak: r
            .map(row('shift'), row('epochMonth'), (shift, epochMonth) =>
              r.branch(shift.eq(epochMonth), '1', '0')
            )
            .reduce((left, right) => left.add(right).default(''))
            .default('')
            // get an array of all the groupings of 1
            .split('0')
            .map((val) => val.count())
            .max()
            .add(1)
        }))
        .max('teamStreak')('teamStreak')
        .run()
    )
  },

  organizations: async ({id: domain}, _args, {dataLoader}) => {
    const organizations = await dataLoader.get('organizationsByActiveDomain').load(domain)
    return organizations
  },

  tier: async ({id: domain}, _args, {dataLoader}) => {
    const organizations = await dataLoader.get('organizationsByActiveDomain').load(domain)
    const tiers: ETierEnum[] = organizations.map(({tier}: OrganizationType) => tier)
    if (tiers.includes('enterprise')) return 'enterprise'
    if (tiers.includes('pro')) return 'pro'
    return 'personal'
  },

  userCount: async ({id: domain}, _args, {dataLoader}) => {
    const organizations = await dataLoader.get('organizationsByActiveDomain').load(domain)
    const orgIds = organizations.map(({id}: OrganizationType) => id)
    const organizationUsersByOrgId = (
      await dataLoader.get('organizationUsersByOrgId').loadMany(orgIds)
    ).filter(errorFilter)
    const organizationUsers = organizationUsersByOrgId.flat()
    const userIds = organizationUsers.map(
      (organizationUser: OrganizationUser) => organizationUser.userId
    )
    const uniqueUserIds = new Set(userIds)
    return uniqueUserIds.size
  }
}

export default Company