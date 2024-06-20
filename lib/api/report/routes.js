import 'dotenv/config.js' // eslint-disable-line import/no-unassigned-import
import express from 'express'
import {getDistrict} from '../district/models.js'
import mongo from '../../util/mongo.cjs'
import auth from '../../middleware/auth.js'
import analyticsMiddleware from '../../middleware/analytics.js'
import {formatAndUpdateReports, formatReportToInsert} from './utils.js'

const app = new express.Router()

app.route('/district/:districtID')
  .get(auth, analyticsMiddleware, async (req, res) => {
    let response
    try {
      const {districtID} = req.params
      const reports = await mongo.db.collection('processing_reports')
        .find({districtID})
        .sort({preProcessingDate: -1})
        .toArray()
      const formattedReports = await formatAndUpdateReports(reports)
      res.send(formattedReports)
    } catch (error) {
      const {message} = error
      response = {
        date: new Date(),
        status: 'error',
        message,
        response: {},
      }
    }

    res.send(response)
  })

app.route('/district/cog/:cog')
  .get(auth, analyticsMiddleware, async (req, res) => {
    let response
    try {
      const {cog} = req.params
      const reports = await mongo.db.collection('processing_reports')
        .find({'meta.cog': cog})
        .sort({preProcessingDate: 1})
        .toArray()
      const formattedReports = await formatAndUpdateReports(reports)
      res.send(formattedReports)
    } catch (error) {
      const {message} = error
      response = {
        date: new Date(),
        status: 'error',
        message,
        response: {},
      }
    }

    res.send(response)
  })

app.route('/district/:districtID')
  .post(auth, analyticsMiddleware, async (req, res) => {
    let response
    try {
      const {districtID} = req.params
      const district = await getDistrict(districtID)

      if (!district) {
        res.status(404).send('Request ID unknown')
        return
      }

      // Count the number of documents with the same districtID
      const count = await mongo.db.collection('processing_reports').countDocuments({districtID})

      // If the count is 5 or more, delete the oldest document based on preProcessingDate
      if (count >= 5) {
        await mongo.db.collection('processing_reports').findOneAndDelete({districtID}, {sort: {preProcessingDate: 1}}).toArray()
      }

      const report = req.body
      const formatedReportToInsert = formatReportToInsert(districtID, report)

      await mongo.db.collection('processing_reports').insertOne(formatedReportToInsert, {upsert: true})
      response = {
        date: new Date(),
        status: 'success',
        message: 'Processing report created successfully',
        response: {},
      }
    } catch (error) {
      const {message} = error
      response = {
        date: new Date(),
        status: 'error',
        message,
        response: {},
      }
    }

    res.send(response)
  })

export default app
