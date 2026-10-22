import {defineField, defineType} from 'sanity'

const body = (name, title, group) =>
  defineField({
    name,
    title,
    group,
    type: 'array',
    of: [
      {
        type: 'block',
        styles: [
          {title: 'Pasus', value: 'normal'},
          {title: 'Naslov', value: 'h2'},
          {title: 'Podnaslov', value: 'h3'},
        ],
        lists: [
          {title: 'Lista', value: 'bullet'},
          {title: 'Numerisana', value: 'number'},
        ],
        marks: {
          decorators: [
            {title: 'Podebljano', value: 'strong'},
            {title: 'Kurziv', value: 'em'},
          ],
          annotations: [
            {
              name: 'link',
              type: 'object',
              title: 'Link',
              fields: [{name: 'href', type: 'url', title: 'Adresa'}],
            },
          ],
        },
      },
    ],
  })

export default defineType({
  name: 'post',
  title: 'Članak',
  type: 'document',
  groups: [
    {name: 'sr', title: 'Srpski', default: true},
    {name: 'en', title: 'English'},
  ],
  fields: [
    defineField({
      name: 'titleSr',
      title: 'Naslov',
      type: 'string',
      group: 'sr',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'excerptSr',
      title: 'Kratak opis',
      type: 'text',
      rows: 3,
      group: 'sr',
    }),
    defineField({
      name: 'leadSr',
      title: 'Uvod',
      type: 'text',
      rows: 2,
      group: 'sr',
    }),
    body('bodySr', 'Tekst', 'sr'),
    defineField({
      name: 'titleEn',
      title: 'Title',
      type: 'string',
      group: 'en',
    }),
    defineField({
      name: 'excerptEn',
      title: 'Excerpt',
      type: 'text',
      rows: 3,
      group: 'en',
    }),
    defineField({
      name: 'leadEn',
      title: 'Lead',
      type: 'text',
      rows: 2,
      group: 'en',
    }),
    body('bodyEn', 'Body', 'en'),
    defineField({
      name: 'slug',
      title: 'Adresa',
      type: 'slug',
      options: {source: 'titleSr', maxLength: 96},
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'date',
      title: 'Datum',
      type: 'date',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'image',
      title: 'Slika',
      type: 'image',
      options: {hotspot: true},
    }),
  ],
  orderings: [
    {
      title: 'Datum, najnovije',
      name: 'dateDesc',
      by: [{field: 'date', direction: 'desc'}],
    },
  ],
  preview: {
    select: {title: 'titleSr', subtitle: 'date', media: 'image'},
  },
})
