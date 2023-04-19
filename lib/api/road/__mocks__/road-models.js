import {bddRoadMock} from './road-data-mock.js'

export async function getRoads(roadIDs) {
  return bddRoadMock.filter(({id}) => roadIDs.includes(id))
}
